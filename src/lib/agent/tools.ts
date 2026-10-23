import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const AGENT_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "ask_clarification",
      description: "صرفاً زمانی که کاربر هیچ کالایی ذکر نکرده و فقط نام یک برند بسیار عام (مانند فقط «سامسونگ») گفته است. هرگز برای جستجوی اولیه کالا استفاده نکنید و گزینه‌های قیمتی فرضی نسازید.",
      parameters: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "متن سؤال کوتاه و شفاف",
          },
          options: {
            type: "array",
            items: { type: "string" },
            description: "لیست گزینه‌های قابل لمس (مثلا ۲ تا ۴ گزینه)",
          },
          field: {
            type: "string",
            enum: ["use_case", "budget", "feature", "brand"],
            description: "زمینه سؤال",
          },
        },
        required: ["question", "options", "field"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_products",
      description: "جستجوی محصولات واقعی در کاتالوگ جامع ترب و بازگرداندن ۳ مدل برتر بر اساس موجودی و قیمت واقعی. این ابزار گام اول و اجباری برای هر درخواست خرید کالا (مانند «کفش چرم»، «لپ‌تاپ»، «هندزفری») است.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "عبارت جستجو، نام مدل یا دسته‌بندی کالا (مثلا هندزفری، کفش چرم، لپ‌تاپ)",
          },
          category: {
            type: "string",
            description: "دسته‌بندی اختیاری",
          },
          max_budget: {
            type: "number",
            description: "حداکثر بودجه کاربر به تومان (اختیاری)",
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
      description: "یافتن فروشگاه‌های حضوری موجود در تهران برای محصول انتخاب‌شده همراه با زمان رسیدن و ترافیک زنده نشان.",
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
