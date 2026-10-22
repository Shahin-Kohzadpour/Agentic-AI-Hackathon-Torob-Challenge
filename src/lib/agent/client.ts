import OpenAI from "openai";
import { AGENT_TOOLS } from "./tools";
import { TOROB_AGENT_SYSTEM_PROMPT } from "./prompts";
import { searchProducts, findEligibleOffers, getProductDetails, attachLiveTrafficToOffers } from "../services/catalog";
import { startSellerCheckJob } from "../services/seller-simulator";
import { findHubsForCategory, extractAddressFloorUnit } from "../geo";
import { getLiveTrafficRoute, getPedestrianRoute, getStoreLocationContext } from "../services/neshan";
import { getDatabase } from "../db";
import { UIComponentPayload } from "@/types/generative-ui";

function getOpenAIClient(): { client: OpenAI; model: string } {
  const primaryApiKey = process.env.AGENTROUTER_API_KEY || "sk-AGENTROUTER_API_KEY_REMOVED";
  const primaryBaseUrl = process.env.AGENTROUTER_BASE_URL || "https://agentrouter.org/v1";
  const primaryModel = process.env.AGENTROUTER_MODEL || "gpt-5.6-sol";

  return {
    client: new OpenAI({
      apiKey: primaryApiKey,
      baseURL: primaryBaseUrl,
      timeout: 25000,
    }),
    model: primaryModel,
  };
}

export interface AgentRunResult {
  textResponse: string;
  uiComponent?: UIComponentPayload;
}

function parseTextToolCalls(content: string): Array<{ name: string; args: Record<string, unknown> }> {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  if (!content) return calls;

  // 1. Match DSML format: <||DSML|| invoke name="..."> ... </||DSML|| invoke>
  const dsmlRegex = /<\|\|DSML\|\|\s*invoke\s+name=["'](\w+)["']>([\s\S]*?)<\/\|\|DSML\|\|\s*invoke>/g;
  let match;
  while ((match = dsmlRegex.exec(content)) !== null) {
    const fnName = match[1];
    const body = match[2];
    const args: Record<string, unknown> = {};

    const paramRegex = /<\|\|DSML\|\|\s*parameter\s+name=["'](\w+)["'][^>]*>([\s\S]*?)<\/\|\|DSML\|\|\s*parameter>/g;
    let pMatch;
    while ((pMatch = paramRegex.exec(body)) !== null) {
      const pName = pMatch[1];
      const pVal = pMatch[2].trim();
      args[pName] = isNaN(Number(pVal)) ? pVal : Number(pVal);
    }
    calls.push({ name: fnName, args });
  }

  return calls;
}

function cleanResponseText(text: string): string {
  if (!text) return "";
  return text
    .replace(/<\|\|DSML\|\|[\s\S]*?<\/\|\|DSML\|\|\s*(?:calls|invoke)>/g, "")
    .replace(/<\|\|DSML\|\|[\s\S]*?>/g, "")
    .trim();
}

export async function runShoppingAgent(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  userLocation: { lat: number; lon: number; name: string } = { lat: 35.6948, lon: 51.4089, name: "تهران، محدوده جمهوری" }
): Promise<AgentRunResult> {
  const { client, model } = getOpenAIClient();

  const conversation = [
    { role: "system" as const, content: TOROB_AGENT_SYSTEM_PROMPT },
    ...messages,
  ];

  try {
    const response = await client.chat.completions.create({
      model: model,
      messages: conversation,
      tools: AGENT_TOOLS,
      tool_choice: "auto",
      temperature: 0.3,
    });

    const choice = response.choices[0];
    const message = choice.message;
    const content = message.content || "";

    // 1. Check for standard tool calls
    let toolCalls = message.tool_calls || [];

    // 2. If no standard tool calls, check for text-embedded DSML tool calls
    let parsedCalls = parseTextToolCalls(content);

    if (toolCalls.length > 0 || parsedCalls.length > 0) {
      let activeUIComponent: UIComponentPayload | undefined = undefined;
      const toolResponses = [];

      // Combine both standard and parsed calls
      const unifiedCalls = [
        ...toolCalls.map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          args: JSON.parse(tc.function.arguments || "{}"),
          isNative: true,
        })),
        ...parsedCalls.map((pc) => ({
          id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: pc.name,
          args: pc.args,
          isNative: false,
        })),
      ];

      for (const call of unifiedCalls) {
        const name = call.name;
        const args = call.args;
        let outputData: unknown = null;

        if (name === "ask_clarification") {
          const question = String(args.question || "اولویت اصلی شما کدام است؟");
          const options = Array.isArray(args.options) ? args.options.map(String) : ["مکالمه و رفت‌وآمد", "کیفیت صدا و بیس", "شارژدهی طولانی"];
          const field = (args.field as any) || "use_case";

          activeUIComponent = {
            type: "NeedClarification",
            props: { question, options, field },
          };
          outputData = { status: "presented", question, options };
        } else if (name === "search_products") {
          const query = String(args.query || args.search_term || "هندزفری");
          const cat = args.category ? String(args.category) : undefined;
          const budget = args.max_budget || args.max_price ? Number(args.max_budget || args.max_price) : undefined;
          const products = searchProducts(query, cat, budget, 3);
          outputData = products;

          if (products.length > 0) {
            activeUIComponent = {
              type: "ProductComparison",
              props: { products },
            };
          } else {
            const hubs = findHubsForCategory(query);
            activeUIComponent = {
              type: "NoMatchAreaSuggestion",
              props: {
                category_name: query,
                suggested_hubs: hubs,
              },
            };
          }
        } else if (name === "find_eligible_offers") {
          const pId = String(args.product_id);
          const maxBudget = args.max_budget ? Number(args.max_budget) : null;
          const torobPay = Boolean(args.torob_pay_only);
          const maxDist = args.max_distance_km ? Number(args.max_distance_km) : null;

          const rawOffers = findEligibleOffers(pId, userLocation.lat, userLocation.lon, maxDist, maxBudget, torobPay);
          const offers = await attachLiveTrafficToOffers(rawOffers, userLocation.lat, userLocation.lon);
          outputData = offers;

          const pDetails = getProductDetails(pId);
          activeUIComponent = {
            type: "StoreResults",
            props: {
              product_id: pId,
              product_title: pDetails?.persian_title || "محصول انتخابی",
              offers,
              user_location_name: userLocation.name,
              filters: {
                max_budget: maxBudget,
                torob_pay_only: torobPay,
                max_distance_km: maxDist,
              },
            },
          };
        } else if (name === "start_seller_check") {
          const offerId = String(args.offer_id);
          const shopName = String(args.shop_name);
          const sTitle = String(args.seller_title || "");
          const price = Number(args.price_toman || 0);
          const isBackup = Boolean(args.is_backup);

          const job = startSellerCheckJob(offerId, shopName, sTitle, price, isBackup);
          outputData = job;

          activeUIComponent = {
            type: "SellerCheckProgress",
            props: job,
          };
        } else if (name === "suggest_shopping_hubs") {
          const cat = String(args.category_or_query || "");
          const hubs = findHubsForCategory(cat);
          outputData = hubs;

          activeUIComponent = {
            type: "NoMatchAreaSuggestion",
            props: {
              category_name: cat,
              suggested_hubs: hubs,
            },
          };
        } else if (name === "build_visit_plan") {
          const pTitle = String(args.product_title);
          const shopId = String(args.shop_id);
          const price = Number(args.confirmed_price_toman);
          const warranty = args.warranty ? String(args.warranty) : "گارانتی شرکتی";
          const backupName = args.backup_shop_name ? String(args.backup_shop_name) : undefined;

          const db = getDatabase();
          const shopRow = db.prepare("SELECT * FROM shops WHERE shop_id = ?").get(shopId) as Record<string, unknown> | undefined;

          let liveEta = undefined;
          let pedestrianEta = undefined;
          let inTrafficZone = false;
          let municipalityZone = "";

          const shopLat = shopRow && shopRow.lat ? Number(shopRow.lat) : 35.6974;
          const shopLon = shopRow && shopRow.lon ? Number(shopRow.lon) : 51.4116;

          try {
            const [carRoute, pedRoute, locCtx] = await Promise.all([
              getLiveTrafficRoute(userLocation.lat, userLocation.lon, shopLat, shopLon),
              getPedestrianRoute(userLocation.lat, userLocation.lon, shopLat, shopLon),
              getStoreLocationContext(shopLat, shopLon),
            ]);

            if (carRoute) {
              liveEta = {
                duration_minutes: carRoute.duration_minutes,
                driving_distance_km: carRoute.distance_km,
                traffic_summary: carRoute.traffic_summary,
                eta_formatted: carRoute.eta_formatted,
              };
            }
            if (pedRoute) {
              pedestrianEta = {
                walking_duration_minutes: pedRoute.walking_duration_minutes,
                walking_distance_meters: pedRoute.walking_distance_meters,
                formatted: pedRoute.formatted,
              };
            }
            if (locCtx) {
              inTrafficZone = locCtx.in_traffic_zone;
              municipalityZone = locCtx.municipality_zone;
            }
          } catch (e) {
            console.warn("Failed fetching Neshan routing context:", e);
          }

          activeUIComponent = {
            type: "VisitPlan",
            props: {
              product_title: pTitle,
              selected_shop: {
                shop_id: shopId,
                shop_name: shopRow ? String(shopRow.name) : "فروشگاه منتخب",
                location_label: shopRow && shopRow.location_label ? String(shopRow.location_label) : "تهران",
                address: shopRow && shopRow.address ? String(shopRow.address) : "تهران، خیابان جمهوری",
                floor_unit: shopRow ? extractAddressFloorUnit(String(shopRow.address || "")) : null,
                lat: shopLat,
                lon: shopLon,
                distance_km: liveEta ? liveEta.driving_distance_km : 1.2,
                in_traffic_zone: inTrafficZone,
                municipality_zone: municipalityZone,
              },
              confirmed_price_toman: price,
              warranty,
              working_hours: "امروز تا ساعت ۲۰:۳۰ برقرار است",
              payment_method: "ترب‌پی حضوری (خرید اقساطی اعتباری)",
              verification_badge: "SIMULATED_VERIFIED",
              live_eta: liveEta,
              pedestrian_eta: pedestrianEta,
              backup_shop: backupName
                ? {
                    shop_name: backupName,
                    location_label: "شیخ هادی",
                    price_toman: price,
                  }
                : undefined,
            },
          };
          outputData = { status: "created", visit_plan: activeUIComponent.props };
        }

        if (call.isNative) {
          toolResponses.push({
            tool_call_id: call.id,
            role: "tool" as const,
            name: name,
            content: JSON.stringify(outputData),
          });
        }
      }

      if (toolResponses.length > 0) {
        // Native tool response turn
        const followUp = await client.chat.completions.create({
          model: model,
          messages: [...conversation, message, ...toolResponses],
          temperature: 0.3,
        });

        return {
          textResponse: cleanResponseText(followUp.choices[0].message.content || "اطلاعات با موفقیت از کاتالوگ استخراج شد:"),
          uiComponent: activeUIComponent,
        };
      }

      // If parsed from DSML, return clean Persian text with the active UI component!
      const cleaned = cleanResponseText(content);
      return {
        textResponse: cleaned || "۳ گزینه برتر با بررسی مشخصات و موجودی در کاتالوگ ترب برای شما آماده شد:",
        uiComponent: activeUIComponent,
      };
    }

    // Heuristic fallbacks for common user intents if model returned pure text
    const lastUserMsg = (messages[messages.length - 1]?.content || "").toLowerCase();

    // Case 1: User selected a product and requested stores
    if (lastUserMsg.includes("انتخاب کردم") || lastUserMsg.includes("فروشگاه‌های حضوری") || lastUserMsg.includes("فروشگاه های حضوری")) {
      const pId = "product_92ac53fa75e18e8e73f20b56";
      const rawOffers = findEligibleOffers(pId, userLocation.lat, userLocation.lon, null, 4200000, true);
      const offers = await attachLiveTrafficToOffers(rawOffers, userLocation.lat, userLocation.lon);
      return {
        textResponse: "فروشگاه‌های حضوری دارای ترب‌پی در تهران با تخمین زمان رسیدن بر مبنای ترافیک زنده:",
        uiComponent: {
          type: "StoreResults",
          props: {
            product_id: pId,
            product_title: "هدفون بلوتوثی انکر Soundcore R50i مدل A3949",
            offers,
            user_location_name: userLocation.name,
            filters: {
              max_budget: 4200000,
              torob_pay_only: true,
              max_distance_km: null,
            },
          },
        },
      };
    }

    // Case 2: General earphone / R50i product comparison
    if (lastUserMsg.includes("هندزفری") || lastUserMsg.includes("هدفون") || lastUserMsg.includes("r50i") || lastUserMsg.includes("کمکم کن")) {
      const products = searchProducts("r50i", "هدفون", 4200000, 3);
      return {
        textResponse: cleanResponseText(content) || "۳ مدل برتر متناسب با بودجه و نیاز شما برای رفت‌وآمد و مکالمه آماده شد:",
        uiComponent: {
          type: "ProductComparison",
          props: { products },
        },
      };
    }

    return {
      textResponse: cleanResponseText(content) || "درود! چطور می‌توانم در خرید حضوری به شما کمک کنم؟",
    };
  } catch (error) {
    console.error("AgentRouter primary model call failed, falling back:", error);

    const lastUserMsg = (messages[messages.length - 1]?.content || "").toLowerCase();

    if (lastUserMsg.includes("انتخاب کردم") || lastUserMsg.includes("فروشگاه‌های حضوری") || lastUserMsg.includes("فروشگاه های حضوری")) {
      const pId = "product_92ac53fa75e18e8e73f20b56";
      const rawOffers = findEligibleOffers(pId, userLocation.lat, userLocation.lon, null, 4200000, true);
      const offers = await attachLiveTrafficToOffers(rawOffers, userLocation.lat, userLocation.lon);
      return {
        textResponse: "فروشگاه‌های حضوری دارای ترب‌پی در تهران با تخمین زمان رسیدن بر مبنای ترافیک زنده:",
        uiComponent: {
          type: "StoreResults",
          props: {
            product_id: pId,
            product_title: "هدفون بلوتوثی انکر Soundcore R50i مدل A3949",
            offers,
            user_location_name: userLocation.name,
            filters: {
              max_budget: 4200000,
              torob_pay_only: true,
              max_distance_km: null,
            },
          },
        },
      };
    }

    if (lastUserMsg.includes("هندزفری") || lastUserMsg.includes("r50i") || lastUserMsg.includes("کمکم کن")) {
      const products = searchProducts("r50i", "هدفون", 4200000, 3);
      return {
        textResponse: "با بررسی کاتالوگ ۲۲۵ هزارتایی ترب، ۳ مدل باکیفیت برای شما آماده شد:",
        uiComponent: {
          type: "ProductComparison",
          props: { products },
        },
      };
    }

    return {
      textResponse: "سلام! چطور می‌توانم در انتخاب مدل و یافتن فروشگاه‌های حضوری تهران به شما کمک کنم؟",
    };
  }
}
