import OpenAI from "openai";
import { AGENT_TOOLS } from "./tools";
import { TOROB_AGENT_SYSTEM_PROMPT } from "./prompts";
import { searchProducts, findEligibleOffers, getProductDetails } from "../services/catalog";
import { startSellerCheckJob } from "../services/seller-simulator";
import { findHubsForCategory, extractAddressFloorUnit } from "../geo";
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

    // Check if tool calls were made
    if (message.tool_calls && message.tool_calls.length > 0) {
      let activeUIComponent: UIComponentPayload | undefined = undefined;
      const toolResponses = [];

      for (const call of message.tool_calls) {
        if (call.type !== "function") continue;
        const name = call.function.name;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments);
        } catch {
          args = {};
        }

        let outputData: unknown = null;

        if (name === "search_products") {
          const query = String(args.query || "");
          const cat = args.category ? String(args.category) : undefined;
          const budget = args.max_budget ? Number(args.max_budget) : undefined;
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

          const offers = findEligibleOffers(pId, userLocation.lat, userLocation.lon, maxDist, maxBudget, torobPay);
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
                lat: shopRow && shopRow.lat ? Number(shopRow.lat) : 35.6948,
                lon: shopRow && shopRow.lon ? Number(shopRow.lon) : 51.4089,
                distance_km: 1.2,
              },
              confirmed_price_toman: price,
              warranty,
              working_hours: "امروز تا ساعت ۲۰:۳۰ برقرار است",
              payment_method: "ترب‌پی حضوری (خرید اقساطی اعتباری)",
              verification_badge: "SIMULATED_VERIFIED",
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

        toolResponses.push({
          tool_call_id: call.id,
          role: "tool" as const,
          name: name,
          content: JSON.stringify(outputData),
        });
      }

      // Second turn with tool responses
      const followUp = await client.chat.completions.create({
        model: model,
        messages: [
          ...conversation,
          message,
          ...toolResponses,
        ],
        temperature: 0.3,
      });

      return {
        textResponse: followUp.choices[0].message.content || "اطلاعات با موفقیت پردازش شد.",
        uiComponent: activeUIComponent,
      };
    }

    return {
      textResponse: message.content || "درود! چطور می‌توانم در خرید حضوری به شما کمک کنم؟",
    };
  } catch (error) {
    console.error("AgentRouter primary model call failed, checking DeepSeek fallback:", error);

    // Fallback to DeepSeek if primary fails
    try {
      const fallbackClient = new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY || "sk-DEEPSEEK_API_KEY_REMOVED",
        baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
        timeout: 20000,
      });
      const dsResp = await fallbackClient.chat.completions.create({
        model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
        messages: conversation,
        temperature: 0.3,
      });
      return {
        textResponse: dsResp.choices[0].message.content || "پاسخ از سرور پشتیبان دریافت شد.",
      };
    } catch (fbErr) {
      console.error("Both models failed:", fbErr);
      return {
        textResponse: "متاسفانه در برقراری ارتباط با سرویس هوش مصنوعی خطایی رخ داد. اما تمام جستجوهای کاتالوگ و فیلترهای فروشگاه‌ها به صورت مستقیم در دسترس هستند.",
      };
    }
  }
}
