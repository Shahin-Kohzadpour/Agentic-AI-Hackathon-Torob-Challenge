import OpenAI from "openai";
import { AGENT_TOOLS } from "./tools";
import { TOROB_AGENT_SYSTEM_PROMPT } from "./prompts";
import { searchProducts, findEligibleOffers, getProductDetails, attachLiveTrafficToOffers } from "../services/catalog";
import { startSellerCheckJob } from "../services/seller-simulator";
import { findHubsForCategory, extractAddressFloorUnit } from "../geo";
import { getLiveTrafficRoute, getPedestrianRoute, getStoreLocationContext } from "../services/neshan";
import { getDatabase } from "../db";
import { UIComponentPayload } from "@/types/generative-ui";

function getPrimaryClient(): { client: OpenAI; model: string } {
  // DeepSeek is our primary high-speed engine with native OpenAI function calling
  const apiKey = process.env.DEEPSEEK_API_KEY || "sk-DEEPSEEK_API_KEY_REMOVED";
  const baseURL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";

  return {
    client: new OpenAI({
      apiKey,
      baseURL,
      timeout: 15000,
    }),
    model,
  };
}

function getFallbackClient(): { client: OpenAI; model: string } {
  const apiKey = process.env.AGENTROUTER_API_KEY || "sk-AGENTROUTER_API_KEY_REMOVED";
  const baseURL = process.env.AGENTROUTER_BASE_URL || "https://agentrouter.org/v1";
  const model = process.env.AGENTROUTER_MODEL || "gpt-5.6-sol";

  return {
    client: new OpenAI({
      apiKey,
      baseURL,
      timeout: 20000,
    }),
    model,
  };
}

export interface AgentRunResult {
  textResponse: string;
  uiComponent?: UIComponentPayload;
}

function cleanQueryKeywords(raw: string): string {
  return raw
    .replace(/(?:سلام|درود|خسته نباشید|لطفا|لطفاً|برام|برای من|چی|چیا|داری|داری؟|میخوام|می‌خوام|معرفی کن|پیشنهاد بده|پیشنهاد میکنی|هست|چی داری|چیا داری|موجوده)/gi, "")
    .trim();
}

async function resolveIntelligentFallback(
  lastUserMsg: string,
  userLocation: { lat: number; lon: number; name: string }
): Promise<AgentRunResult> {
  const norm = lastUserMsg.toLowerCase();

  // 1. User selected a product and wants in-person stores
  if (norm.includes("انتخاب کردم") || norm.includes("فروشگاه‌های حضوری") || norm.includes("فروشگاه های حضوری") || norm.includes("کجا بخرم")) {
    const titleMatch = lastUserMsg.match(/«([^»]+)»/);
    let pId: string | null = null;
    let pTitle: string = "محصول انتخابی";

    const db = getDatabase();
    if (titleMatch) {
      const row = db.prepare("SELECT product_id, persian_title FROM products WHERE persian_title = ? OR persian_title LIKE ? LIMIT 1").get(titleMatch[1], `%${titleMatch[1]}%`) as { product_id: string; persian_title: string } | undefined;
      if (row) {
        pId = row.product_id;
        pTitle = row.persian_title;
      }
    }

    if (!pId) {
      const cleanQ = cleanQueryKeywords(norm);
      const searchQ = cleanQ.length > 1 ? cleanQ : norm;
      const candidates = searchProducts(searchQ, null, null, 1);
      if (candidates.length > 0) {
        pId = candidates[0].product_id;
        pTitle = candidates[0].persian_title;
      }
    }

    if (pId) {
      const rawOffers = findEligibleOffers(pId, userLocation.lat, userLocation.lon, null, null, false);
      const offers = await attachLiveTrafficToOffers(rawOffers, userLocation.lat, userLocation.lon);
      return {
        textResponse: `فروشگاه‌های حضوری تهران برای «${pTitle}» با زمان رسیدن و وضعیت ترافیک زنده:`,
        uiComponent: {
          type: "StoreResults",
          props: {
            product_id: pId,
            product_title: pTitle,
            offers,
            user_location_name: userLocation.name,
            filters: {
              max_budget: null,
              torob_pay_only: false,
              max_distance_km: null,
            },
          },
        },
      };
    }
  }

  // 2. User confirms seller check and requests final visit plan
  if (norm.includes("تأیید شد") || norm.includes("برنامه مراجعه") || norm.includes("کارت نهایی") || norm.includes("مسیر را نمایش")) {
    const db = getDatabase();
    const shopMatch = lastUserMsg.match(/فروشگاه\s*«([^»]+)»/);
    const prodMatch = lastUserMsg.match(/موجودی\s*«([^»]+)»/);
    
    const shopName = shopMatch ? shopMatch[1] : "";
    const prodTitle = prodMatch ? prodMatch[1] : "کالای انتخابی";
    
    let shopRow = db.prepare("SELECT * FROM shops WHERE name LIKE ? LIMIT 1").get(`%${shopName}%`) as Record<string, unknown> | undefined;
    if (!shopRow && shopName) {
      shopRow = db.prepare("SELECT * FROM shops WHERE name = ? LIMIT 1").get(shopName) as Record<string, unknown> | undefined;
    }
    if (!shopRow) {
      shopRow = db.prepare("SELECT * FROM shops WHERE location_label LIKE '%فردوسی%' OR location_label LIKE '%جمهوری%' LIMIT 1").get() as Record<string, unknown> | undefined;
    }

    const sLat = shopRow?.lat ? Number(shopRow.lat) : 35.6981;
    const sLon = shopRow?.lon ? Number(shopRow.lon) : 51.4194;

    const [carRoute, pedRoute, locCtx] = await Promise.all([
      getLiveTrafficRoute(userLocation.lat, userLocation.lon, sLat, sLon),
      getPedestrianRoute(userLocation.lat, userLocation.lon, sLat, sLon),
      getStoreLocationContext(sLat, sLon),
    ]);

    return {
      textResponse: `کارت نهایی مراجعه حضوری به فروشگاه «${shopRow?.name || shopName}» با تخمین ترافیک زنده نشان آماده شد:`,
      uiComponent: {
        type: "VisitPlan",
        props: {
          product_title: prodTitle,
          selected_shop: {
            shop_id: String(shopRow?.shop_id || "shop_selected"),
            shop_name: String(shopRow?.name || shopName),
            location_label: String(shopRow?.location_label || "تهران"),
            address: String(shopRow?.address || "تهران"),
            floor_unit: shopRow ? extractAddressFloorUnit(String(shopRow.address || "")) : null,
            lat: sLat,
            lon: sLon,
            distance_km: carRoute ? carRoute.distance_km : 1.2,
            in_traffic_zone: locCtx ? locCtx.in_traffic_zone : false,
            municipality_zone: locCtx ? locCtx.municipality_zone : "",
          },
          confirmed_price_toman: 14150000,
          warranty: "تضمین اصالت و سلامت کالا در محل فروشگاه",
          working_hours: "امروز تا ساعت ۲۰:۳۰ برقرار است",
          payment_method: shopRow?.has_torob_pay_in_person === 1 ? "ترب‌پی حضوری (اقساطی) و کارت‌خوان" : "کارت‌خوان و پرداخت نقدی حضوری",
          verification_badge: "SIMULATED_VERIFIED",
          live_eta: carRoute ? {
            duration_minutes: carRoute.duration_minutes,
            driving_distance_km: carRoute.distance_km,
            traffic_summary: carRoute.traffic_summary,
            eta_formatted: carRoute.eta_formatted,
          } : undefined,
          pedestrian_eta: pedRoute ? {
            walking_duration_minutes: pedRoute.walking_duration_minutes,
            walking_distance_meters: pedRoute.walking_distance_meters,
            formatted: pedRoute.formatted,
          } : undefined,
        },
      },
    };
  }

  // 2. Broad brand queries clarification (شیائومی، سامسونگ، اپل)
  if (norm === "شیائومی" || norm === "xiaomi") {
    return {
      textResponse: "برای برند شیائومی، رده محصول مد نظرتان را مشخص فرمایید:",
      uiComponent: {
        type: "NeedClarification",
        props: {
          question: "کدام گروه از محصولات شیائومی را می‌خواهید؟",
          field: "use_case",
          options: [
            "گوشی‌های موبایل شیائومی",
            "هندزفری و ساعت هوشمند شیائومی",
            "لوازم خانگی و گجت‌های شیائومی",
          ],
        },
      },
    };
  }

  if (norm === "سامسونگ" || norm === "samsung") {
    return {
      textResponse: "برای برند سامسونگ، رده محصول مد نظرتان را انتخاب فرمایید:",
      uiComponent: {
        type: "NeedClarification",
        props: {
          question: "کدام گروه از محصولات سامسونگ را ترجیح می‌دهید؟",
          field: "use_case",
          options: [
            "گوشی‌های اقتصادی سری Galaxy A",
            "گوشی‌های پرچمدار سری Galaxy S",
            "ساعت هوشمند و هندزفری Galaxy Buds",
          ],
        },
      },
    };
  }

  // 3. Dynamic search in catalog
  const cleanQ = cleanQueryKeywords(norm);
  const searchQ = cleanQ.length > 1 ? cleanQ : norm;

  const foundProducts = searchProducts(searchQ, null, null, 3);
  if (foundProducts.length > 0) {
    return {
      textResponse: `۳ مدل پیشنهادی «${searchQ}» در کارت‌های زیر آماده مقایسه است. مدل مد نظرتان را انتخاب کنید:`,
      uiComponent: {
        type: "ProductComparison",
        props: { products: foundProducts },
      },
    };
  }

  // 4. If product not in catalog, recommend physical shopping hubs in Tehran
  const hubs = findHubsForCategory(searchQ);
  if (hubs.length > 0) {
    return {
      textResponse: `این کالا در کاتالوگ آنلاین فعلی موجود نیست؛ اما می‌توانید در بورس‌های تخصصی زیر در تهران آن را حضوری تهیه کنید:`,
      uiComponent: {
        type: "NoMatchAreaSuggestion",
        props: {
          category_name: searchQ,
          suggested_hubs: hubs,
        },
      },
    };
  }

  return {
    textResponse: `برای «${searchQ}» مدلی در این محدوده یافت نشد. می‌توانید از دسته‌بندی‌های زیر انتخاب نمایید:`,
    uiComponent: {
      type: "NeedClarification",
      props: {
        question: "کدام گروه از کالاهای پرتقاضای بازار تهران را می‌خواهید؟",
        options: [
          "کفش و پوشاک در مراکز خرید تهران",
          "گوشی موبایل و لوازم جانبی",
          "لپ‌تاپ و تجهیزات دیجیتال",
          "هدفون و ساعت هوشمند",
        ],
      },
    },
  };
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
  const conversation = [
    { role: "system" as const, content: TOROB_AGENT_SYSTEM_PROMPT },
    ...messages,
  ];

  let client;
  let model;
  let response;

  try {
    const primary = getPrimaryClient();
    client = primary.client;
    model = primary.model;

    response = await client.chat.completions.create({
      model: model,
      messages: conversation,
      tools: AGENT_TOOLS,
      tool_choice: "auto",
      temperature: 0.3,
    });
  } catch (primErr) {
    console.warn("Primary LLM (DeepSeek) failed, trying fallback:", primErr);
    try {
      const fallback = getFallbackClient();
      client = fallback.client;
      model = fallback.model;

      response = await client.chat.completions.create({
        model: model,
        messages: conversation,
        tools: AGENT_TOOLS,
        tool_choice: "auto",
        temperature: 0.3,
      });
    } catch (secErr) {
      console.error("All LLMs failed, executing intelligent fallback:", secErr);
      const lastUserMsg = messages[messages.length - 1]?.content || "";
      return await resolveIntelligentFallback(lastUserMsg, userLocation);
    }
  }

  try {
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
          // Zero-Hallucination Guardrail:
          // If the user's message contains an actual product or category that exists in our catalog,
          // do NOT display fabricated clarification chips! Automatically show real catalog products!
          const lastUserMsg = messages[messages.length - 1]?.content || "";
          const cleanQ = cleanQueryKeywords(lastUserMsg);
          const searchQ = cleanQ.length > 1 ? cleanQ : lastUserMsg;
          
          const isPureBrand = ["سامسونگ", "samsung", "شیائومی", "xiaomi", "اپل", "apple"].includes(searchQ.toLowerCase().trim());
          
          if (!isPureBrand && searchQ.trim().length >= 2) {
            const foundProducts = searchProducts(searchQ, null, null, 3);
            if (foundProducts.length > 0) {
              activeUIComponent = {
                type: "ProductComparison",
                props: { products: foundProducts },
              };
              outputData = foundProducts;
              continue;
            }
          }

          const question = String(args.question || "اولویت اصلی شما کدام است؟");
          const options = Array.isArray(args.options) ? args.options.map(String) : [
            "کفش و پوشاک در مراکز خرید تهران",
            "گوشی موبایل و لوازم جانبی",
            "لپ‌تاپ و تجهیزات دیجیتال",
            "هدفون و ساعت هوشمند",
          ];
          const field = (args.field as any) || "use_case";

          activeUIComponent = {
            type: "NeedClarification",
            props: { question, options, field },
          };
          outputData = { status: "presented", question, options };
        } else if (name === "search_products") {
          const lastUserMsg = messages[messages.length - 1]?.content || "";
          const cleanUserQ = cleanQueryKeywords(lastUserMsg);
          const query = String(args.query || args.search_term || cleanUserQ || "");
          const cat = args.category ? String(args.category) : undefined;
          let budget = args.max_budget || args.max_price ? Number(args.max_budget || args.max_price) : undefined;
          if (!budget) {
            const m = query.match(/تا\s*(\d+(?:[.,]\d+)?)\s*میلیون/);
            if (m) {
              budget = parseFloat(m[1].replace(",", ".")) * 1000000;
            }
          }
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
          let pId = String(args.product_id || "");
          const db = getDatabase();

          // Resolve real product_id if model passed a title, or if ID doesn't exist directly
          const rowCheck = db.prepare("SELECT product_id, persian_title FROM products WHERE product_id = ?").get(pId) as { product_id: string; persian_title: string } | undefined;
          if (!rowCheck) {
            const lastUserMsg = messages[messages.length - 1]?.content || "";
            const titleMatch = lastUserMsg.match(/«([^»]+)»/);
            const lookupTitle = titleMatch ? titleMatch[1] : pId;
            const matchRow = db.prepare("SELECT product_id, persian_title FROM products WHERE persian_title = ? OR persian_title LIKE ? LIMIT 1").get(lookupTitle, `%${lookupTitle}%`) as { product_id: string; persian_title: string } | undefined;
            if (matchRow) {
              pId = matchRow.product_id;
            }
          }

          const maxBudget = args.max_budget ? Number(args.max_budget) : null;
          // TorobPay must NEVER be forced by default unless user explicitly asked for it
          let torobPay = Boolean(args.torob_pay_only);
          const maxDist = args.max_distance_km ? Number(args.max_distance_km) : null;

          let rawOffers = findEligibleOffers(pId, userLocation.lat, userLocation.lon, maxDist, maxBudget, torobPay);
          
          // Zero Dead-End Guarantee:
          // If torobPay was requested, but 0 stores have in-person TorobPay,
          // automatically fallback to regular physical stores in Tehran (cash/card/POS)!
          let relaxedFromTorobPay = false;
          if (rawOffers.length === 0 && torobPay) {
            const allOffers = findEligibleOffers(pId, userLocation.lat, userLocation.lon, maxDist, maxBudget, false);
            if (allOffers.length > 0) {
              rawOffers = allOffers;
              torobPay = false;
              relaxedFromTorobPay = true;
            }
          }

          const offers = await attachLiveTrafficToOffers(rawOffers, userLocation.lat, userLocation.lon);
          outputData = {
            offers,
            relaxed_from_torob_pay: relaxedFromTorobPay,
            store_count: offers.length,
          };

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
          const pTitle = String(args.product_title || "");
          let shopId = String(args.shop_id || "");
          const price = Number(args.confirmed_price_toman || 0);
          const warranty = args.warranty ? String(args.warranty) : "گارانتی شرکتی";
          const backupName = args.backup_shop_name ? String(args.backup_shop_name) : undefined;

          const db = getDatabase();
          let shopRow = db.prepare("SELECT * FROM shops WHERE shop_id = ?").get(shopId) as Record<string, unknown> | undefined;
          
          if (!shopRow) {
            // Resolve by shop name if model passed name or from user message
            const lastUserMsg = messages[messages.length - 1]?.content || "";
            const nameMatch = lastUserMsg.match(/«([^»]+)»/);
            const lookupName = nameMatch ? nameMatch[1] : shopId;
            shopRow = db.prepare("SELECT * FROM shops WHERE name = ? OR name LIKE ? LIMIT 1").get(lookupName, `%${lookupName}%`) as Record<string, unknown> | undefined;
            if (shopRow) {
              shopId = String(shopRow.shop_id);
            }
          }

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
              payment_method: shopRow && shopRow.has_torob_pay_in_person === 1
                ? "ترب‌پی حضوری (اقساطی) و کارت‌خوان"
                : "پرداخت با کارت‌خوان و نقدی در محل فروشگاه",
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
        const followUpMessages = [
          ...conversation,
          message,
          ...toolResponses,
          {
            role: "system" as const,
            content:
              "یادآوری ضروری: تمام داده‌ها به صورت کارت‌های گرافیکی لمسی زیر پیام شما رندر شده‌اند. بنابراین در این پاسخ متنی، مطلقاً نباید نام کالاها، قیمت‌ها، مشخصات فنی یا شماره‌گذاری (۱، ۲، ۳) را تکرار کنید. فقط در ۱ یا ۲ جمله کوتاه و صمیمی کاربر را راهنمایی کنید که با لمس دکمه‌های کارت زیرین اقدام کند.",
          },
        ];

        const followUp = await client.chat.completions.create({
          model: model,
          messages: followUpMessages,
          temperature: 0.2,
        });

        let textOut = cleanResponseText(followUp.choices[0].message.content || "");

        // Programmatic Guardrail: If model still outputted bullet points or repeated specs, enforce clean concise copy!
        if (activeUIComponent?.type === "ProductComparison") {
          if (textOut.includes("۱)") || textOut.includes("1)") || textOut.includes("فروشنده") || textOut.length > 160) {
            textOut = "۳ مدل منتخب کاتالوگ ترب را در کارت‌های زیر مقایسه کنید. با لمس دکمه «انتخاب»، فروشگاه‌های حضوری در تهران را نمایش می‌دهم:";
          }
        } else if (activeUIComponent?.type === "StoreResults") {
          if (textOut.includes("۱)") || textOut.includes("1)") || textOut.includes("پیدا نشد") || textOut.length > 160) {
            textOut = "فروشگاه‌های حضوری در تهران با تخمین زمان رسیدن و ترافیک زنده نشان آماده مراجعه هستند:";
          }
        } else if (activeUIComponent?.type === "NeedClarification") {
          if (textOut.includes("۱)") || textOut.includes("1)") || textOut.length > 160) {
            textOut = "برای یافتن دقیق‌ترین گزینه‌های بازار حضوری تهران، رده مد نظرتان را مشخص فرمایید:";
          }
        }

        return {
          textResponse: textOut || "اطلاعات با موفقیت آماده شد:",
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

    // If model returned pure text without any tools, or didn't provide a component:
    const lastUserMsg = messages[messages.length - 1]?.content || "";
    const smartFallback = await resolveIntelligentFallback(lastUserMsg, userLocation);

    return {
      textResponse: cleanResponseText(content) || smartFallback.textResponse,
      uiComponent: smartFallback.uiComponent,
    };
  } catch (error) {
    console.error("Agent error in LLM orchestration, falling back:", error);
    const lastUserMsg = messages[messages.length - 1]?.content || "";
    return await resolveIntelligentFallback(lastUserMsg, userLocation);
  }
}
