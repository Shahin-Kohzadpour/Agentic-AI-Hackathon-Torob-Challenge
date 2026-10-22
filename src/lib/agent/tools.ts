import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const AGENT_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_products",
      description: "جستجوی محصولات در کاتالوگ جامع ترب و بازگرداندن ۳ مدل برتر همراه با مشخصات و قیمت پایه برای مقایسه",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "عبارت جستجو، نام مدل یا دسته‌بندی کالا (مثلا هندزفری انکر r50i، گوشی سامسونگ)",
          },
          category: {
            type: "string",
            description: "دسته‌بندی اختیاری (مثلاً هدفون، گوشی موبایل)",
          },
          max_budget: {
            type: "number",
            description: "حداکثر بودجه کاربر به تومان",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_eligible_offers",
      description: "یافتن فروشگاه‌های حضوری تهران که محصول انتخاب شده را موجود دارند با فیلتر بودجه، فاصله و ترب‌پی حضوری",
      parameters: {
        type: "object",
        properties: {
          product_id: {
            type: "string",
            description: "شناسه دقیق محصول در کاتالوگ ترب",
          },
          max_budget: {
            type: "number",
            description: "سقف بودجه به تومان",
          },
          torob_pay_only: {
            type: "boolean",
            description: "آیا فقط فروشگاه‌های دارای پذیرندگی حضوری ترب‌پی نمایش داده شوند؟",
          },
          max_distance_km: {
            type: "number",
            description: "حداکثر فاصله مجاز بر حسب کیلومتر",
          },
        },
        required: ["product_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "start_seller_check",
      description: "شروع استعلام شبیه‌سازی‌شده وضعیت موجودی، قیمت و ساعت کاری از فروشگاه انتخابی",
      parameters: {
        type: "object",
        properties: {
          offer_id: {
            type: "string",
            description: "شناسه آفر فروشگاه",
          },
          shop_name: {
            type: "string",
            description: "نام فروشگاه",
          },
          seller_title: {
            type: "string",
            description: "عنوان کالای ثبت شده توسط فروشنده",
          },
          price_toman: {
            type: "number",
            description: "قیمت ثبت‌شده به تومان",
          },
          is_backup: {
            type: "boolean",
            description: "آیا این فروشگاه جایگزین (آلترناتیو) است؟",
          },
        },
        required: ["offer_id", "shop_name", "price_toman"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_shopping_hubs",
      description: "پیشنهاد راسته بازارها و بورس‌های تخصصی کالا در تهران در صورت نبود کالا در کاتالوگ یا نیاز به مراجعه حضوری به بازار",
      parameters: {
        type: "object",
        properties: {
          category_or_query: {
            type: "string",
            description: "نام کالا یا حوزه مورد نظر (مثلا الکترونیک، موبایل، لوازم خانگی)",
          },
        },
        required: ["category_or_query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "build_visit_plan",
      description: "تولید کارت نهایی مراجعه حضوری با آدرس کامل، پلاک/واحد و وضعیت تایید شبیه‌سازی‌شده",
      parameters: {
        type: "object",
        properties: {
          product_title: {
            type: "string",
            description: "عنوان محصول خریداری شده",
          },
          shop_id: {
            type: "string",
            description: "شناسه فروشگاه انتخاب شده",
          },
          confirmed_price_toman: {
            type: "number",
            description: "قیمت تایید شده به تومان",
          },
          warranty: {
            type: "string",
            description: "شرایط گارانتی کالا",
          },
          backup_shop_name: {
            type: "string",
            description: "نام فروشگاه جایگزین در صورت لزوم",
          },
        },
        required: ["product_title", "shop_id", "confirmed_price_toman"],
      },
    },
  },
];
