# 🎨 Studio in Chat — توليد صور بالذكاء الاصطناعي داخل المحادثة

إضافة ميزة **Studio in Chat** لتمكين المستخدم من توليد صور إبداعية مباشرة داخل المحادثة، باستخدام نموذج `gemini-3.1-flash-image-preview` من Google.

---

## الوضع الحالي للكود

التطبيق لديه بالفعل بنية تحتية قوية لتوليد الصور:

| الميزة الموجودة | الحالة | الطريقة |
|---|---|---|
| توليد صور السيلفي (Selfie) | ✅ يعمل | `generateSelfie()` مع صورة مرجعية للأفاتار |
| بروتوكول السيلفي التلقائي | ✅ يعمل | `[[GENERATE_SELFIE: desc]]` في نص البوت |
| توليد عام `generateImage()` | ✅ موجود بالسيرفر | لكنه **غير مربوط بالشات** — يُستدعى فقط عبر RPC مباشر |
| عرض الصور في الفقاعات | ✅ يعمل | `ChatBubble.tsx` يعرض أي `Attachment` من نوع صورة |
| نظام التوافق البصري | ✅ يعمل | `VisualSeed` + `visualEngine.ts` |

**الفجوة الرئيسية**: لا يوجد وضع **Studio** مخصص يتيح للمستخدم توليد صور إبداعية متنوعة (ليست سيلفي فقط) داخل الشات مع خيارات تحكم (نسبة العرض، الحجم، الأسلوب).

---

## مراجعة المستخدم المطلوبة

> [!IMPORTANT]
> **اسم النموذج**: التوثيق الرسمي من Google يؤكد أن `gemini-3.1-flash-image-preview` هو أحدث نموذج لتوليد الصور. الكود الحالي يستخدم `gemini-3-pro-image-preview` و `gemini-2.5-flash-image` كـ fallback. هل تريد:
> 1. جعل `gemini-3.1-flash-image-preview` هو النموذج الأساسي مع الاحتفاظ بالـ fallback chain؟
> 2. استخدام `gemini-3.1-flash-image-preview` فقط بدون fallback؟

> [!WARNING]
> **السلامة (Safety Settings)**: الكود الحالي يستخدم `BLOCK_NONE` لجميع فئات السلامة في توليد الصور. نموذج `gemini-3.1-flash-image-preview` قد يكون أكثر تقييدًا. هل تريد الاحتفاظ بنفس إعدادات السلامة أم تعديلها؟

---

## أسئلة مفتوحة

> [!IMPORTANT]
> **1. تجربة المستخدم — كيف يتم تفعيل الـ Studio؟**
> - **الخيار أ (موصى)**: زر 🎨 جديد في شريط الأدوات (بجانب الكاميرا والمرفقات). الضغط عليه يدخل "وضع Studio" مع تغيير لون الإدخال وأيقونة مميزة.
> - **الخيار ب**: إضافته كخيار في قائمة المرفقات الحالية (بجانب Upload Photo و Generate Selfie).
> - **الخيار ج**: كلاهما — زر سريع + خيار في القائمة.

> [!IMPORTANT]
> **2. لوحة إعدادات الصورة (Image Settings Panel)**
> هل تريد لوحة إعدادات تظهر عند تفعيل الـ Studio تتضمن:
> - نسبة العرض إلى الارتفاع (1:1, 3:4, 4:3, 9:16, 16:9)
> - الحجم (1K, 2K, 4K)
> - أسلوب فني (واقعي، كرتوني، رسم زيتي، أنمي، إلخ)
> أم تفضل تجربة بسيطة (وصف فقط) مع القيم الافتراضية؟

> [!IMPORTANT]
> **3. توليد تلقائي من البوت**
> هل تريد أن يكون البوت قادرًا على توليد صور تلقائيًا أثناء المحادثة (مثل بروتوكول السيلفي الحالي `[[GENERATE_SELFIE:...]]`)؟ مثلاً يمكن إضافة بروتوكول `[[GENERATE_IMAGE: description]]` بحيث البوت يولّد صور من تلقاء نفسه أثناء الشات العادي.

> [!IMPORTANT]
> **4. المحادثة التكرارية (Iterative Editing)**
> `gemini-3.1-flash-image-preview` يدعم **تعديل الصور بالمحادثة** (مثل "غيّر الخلفية لأزرق"، "أضف شمس"). هل تريد تفعيل هذه الميزة حيث يمكن للمستخدم تعديل الصورة المولّدة عبر رسائل متتابعة؟

---

## التغييرات المقترحة

### المكون 1: Types & Models (الأنواع والنماذج)

---

#### [MODIFY] [types.ts](file:///Users/mamdouhaboammar/Downloads/رفيق%20للنشر%20والاختبار/types.ts)

إضافة أنواع جديدة لدعم Studio mode:

```diff
 // AppMode enum — إضافة وضع جديد
-export type AppMode = 'CHAT' | 'LIVE_VOICE' | 'VEO_VIDEO' | 'IMAGE_GEN';
+export type AppMode = 'CHAT' | 'LIVE_VOICE' | 'VEO_VIDEO' | 'IMAGE_GEN' | 'STUDIO';

 // إضافة أنواع Studio
+export type StudioStyle = 'realistic' | 'cartoon' | 'anime' | 'oil_painting' | 'watercolor' | 'sketch' | 'digital_art' | 'cinematic';
+
+export interface StudioConfig {
+  aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
+  size: '1K' | '2K' | '4K';
+  style?: StudioStyle;
+  enhancePrompt?: boolean; // تحسين الوصف تلقائياً
+}
+
+export interface StudioMessage {
+  prompt: string;
+  config: StudioConfig;
+  referenceImage?: string; // base64 لصورة مرجعية للتعديل
+}
```

---

#### [MODIFY] [geminiModels.ts](file:///Users/mamdouhaboammar/Downloads/رفيق%20للنشر%20والاختبار/services/geminiModels.ts)

إضافة نموذج Studio الجديد:

```diff
+// === Studio Image Generation Models ===
+export const STUDIO_IMAGE_MODEL = 'gemini-3.1-flash-image-preview';
+export const STUDIO_IMAGE_MODEL_CHAIN = [
+  'gemini-3.1-flash-image-preview',
+  'gemini-3-pro-image-preview',
+  'gemini-2.5-flash-image'
+];
+
+// Style prompts mapping
+export const STUDIO_STYLE_PROMPTS: Record<string, string> = {
+  realistic: 'photorealistic, highly detailed, natural lighting',
+  cartoon: 'cartoon style, vibrant colors, bold outlines',
+  anime: 'anime art style, Japanese animation, detailed eyes',
+  oil_painting: 'oil painting style, textured brushstrokes, classical art',
+  watercolor: 'watercolor painting, soft edges, flowing colors',
+  sketch: 'pencil sketch, hand-drawn, detailed linework',
+  digital_art: 'digital art, modern illustration, clean lines',
+  cinematic: 'cinematic composition, dramatic lighting, movie still',
+};
```

---

### المكون 2: Server-Side (منطق السيرفر)

---

#### [MODIFY] [geminiService.server.ts](file:///Users/mamdouhaboammar/Downloads/رفيق%20للنشر%20والاختبار/services/geminiService.server.ts)

إضافة دالة `generateStudioImage()` الجديدة:

```typescript
/**
 * Studio in Chat — توليد صور إبداعية داخل المحادثة
 * يستخدم gemini-3.1-flash-image-preview مع responseModalities: ['TEXT', 'IMAGE']
 */
export async function generateStudioImage(
  prompt: string,
  config: StudioConfig,
  referenceImage?: string, // base64 data URI لتعديل صورة موجودة
  context?: { visualSeed?: VisualSeed; mood?: string }
): Promise<{ imageUrl: string; description: string }> {
  const ai = createGoogleGenAIClient();
  
  // بناء البرومبت المحسّن
  let enhancedPrompt = prompt;
  if (config.style && STUDIO_STYLE_PROMPTS[config.style]) {
    enhancedPrompt += `. Style: ${STUDIO_STYLE_PROMPTS[config.style]}`;
  }
  if (context?.visualSeed) {
    enhancedPrompt += `. ${getVisualPromptModifiers(context.visualSeed)}`;
  }
  if (context?.mood) {
    enhancedPrompt += `. ${getEmotionVisualModifiers(context.mood)}`;
  }

  // بناء المحتوى (نص + صورة مرجعية إن وُجدت)
  const parts: any[] = [{ text: enhancedPrompt }];
  if (referenceImage) {
    const [mimeType, data] = parseDataUri(referenceImage);
    parts.push({ inlineData: { mimeType, data } });
  }

  // محاولة التوليد مع model chain fallback
  for (const modelId of STUDIO_IMAGE_MODEL_CHAIN) {
    try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: [{ role: 'user', parts }],
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          temperature: 1.0,
          safetySettings: UNRESTRICTED_SAFETY_SETTINGS,
        },
      });

      // استخراج الصورة والنص من الاستجابة
      const responseParts = response.candidates?.[0]?.content?.parts || [];
      let imageUrl = '';
      let description = '';

      for (const part of responseParts) {
        if (part.text) {
          description += part.text;
        } else if (part.inlineData) {
          const { mimeType, data } = part.inlineData;
          imageUrl = `data:${mimeType};base64,${data}`;
        }
      }

      if (imageUrl) {
        return { imageUrl, description: description || 'تم توليد الصورة بنجاح ✨' };
      }
    } catch (err) {
      console.warn(`[Studio] Model ${modelId} failed:`, err);
      continue; // جرّب النموذج التالي
    }
  }

  throw new Error('فشل توليد الصورة — جرّب وصفًا مختلفًا');
}
```

**تعديل `sendMessageToGemini`** لدعم بروتوكول `[[GENERATE_IMAGE:...]]`:

```diff
 // في نهاية sendMessageToGemini — بعد bio leak check
+// كشف بروتوكول توليد الصور التلقائي
+const imageGenMatch = finalText.match(/\[\[GENERATE_IMAGE:\s*([\s\S]*?)\]\]/);
+if (imageGenMatch) {
+  // يُعالج في useChatController
+}
```

---

#### [MODIFY] [api/gemini.ts](file:///Users/mamdouhaboammar/Downloads/رفيق%20للنشر%20والاختبار/api/gemini.ts)

تسجيل الدالة الجديدة في خريطة الـ ACTIONS:

```diff
 const ACTIONS: Record<string, Function> = {
   sendMessageToGemini,
   generateGroupResponse,
   // ... existing
   generateImage,
   generateSelfie,
+  generateStudioImage,
   // ...
 };
```

---

### المكون 3: Client-Side Service (خدمة العميل)

---

#### [MODIFY] [geminiService.ts](file:///Users/mamdouhaboammar/Downloads/رفيق%20للنشر%20والاختبار/services/geminiService.ts)

إضافة وكيل RPC للدالة الجديدة:

```diff
+export const generateStudioImage = (...args: any[]) => rpc('generateStudioImage', ...args);
```

---

### المكون 4: UI (واجهة المستخدم)

---

#### [MODIFY] [useChatController.ts](file:///Users/mamdouhaboammar/Downloads/رفيق%20للنشر%20والاختبار/hooks/useChatController.ts)

إضافة مسار معالجة Studio mode في `processBotResponse()`:

```typescript
// === مسار جديد: Studio Mode ===
if (appMode === 'STUDIO') {
  try {
    const studioConfig = currentChat.studioConfig || {
      aspectRatio: '1:1', size: '2K', style: 'realistic'
    };
    
    const result = await GeminiService.generateStudioImage(
      combinedText,
      studioConfig,
      undefined, // referenceImage — للتعديل التكراري
      { visualSeed: currentChat.settings.visualSeed, mood: evolvedPsych.mood }
    );

    await addBotMessage(result.description, undefined, [{
      file: new File([], 'studio-image.png'),
      mimeType: 'image/png',
      previewUrl: result.imageUrl,
      base64: result.imageUrl.split(',')[1]
    }], evolvedPsych, currentChat);
  } catch (err) {
    await addBotMessage(
      'عذرًا، ما قدرت أولّد الصورة 😅 جرّب وصف مختلف',
      undefined, undefined, evolvedPsych, currentChat
    );
  }
  return;
}

// === تعديل مسار CHAT — دعم بروتوكول [[GENERATE_IMAGE:...]] ===
// بعد selfieMatch الموجود:
const imageGenMatch = text.match(/\[\[GENERATE_IMAGE:\s*([\s\S]*?)\]\]/);
if (imageGenMatch) {
  const imagePrompt = imageGenMatch[1].trim();
  text = text.replace(/\[\[GENERATE_IMAGE:[\s\S]*?\]\]/, '').trim();
  try {
    const result = await GeminiService.generateStudioImage(
      imagePrompt, 
      { aspectRatio: '1:1', size: '2K' },
      undefined,
      { visualSeed: currentChat.settings.visualSeed, mood: evolvedPsych.mood }
    );
    imageAttachment = {
      file: new File([], 'ai-image.png'),
      mimeType: 'image/png',
      previewUrl: result.imageUrl,
      base64: result.imageUrl.split(',')[1]
    };
  } catch (e) { /* ignore — send text only */ }
}
```

---

#### [MODIFY] [ChatInterface.tsx](file:///Users/mamdouhaboammar/Downloads/رفيق%20للنشر%20والاختبار/components/ChatInterface.tsx)

إضافة واجهة Studio في الشات:

**1. زر Studio في شريط الأدوات:**
```tsx
{/* زر Studio — بجانب زر الكاميرا */}
<button
  onClick={() => setAppMode(appMode === 'STUDIO' ? 'CHAT' : 'STUDIO')}
  className={`p-2 rounded-full transition-all ${
    appMode === 'STUDIO' 
      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30' 
      : 'text-gray-400 hover:text-purple-400'
  }`}
  title="Studio — توليد صور"
>
  <svg>🎨</svg> {/* أيقونة ريشة أو لوحة */}
</button>
```

**2. شريط إعدادات Studio (يظهر أعلى حقل الإدخال):**
```tsx
{appMode === 'STUDIO' && (
  <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-900/20 to-pink-900/20 border-b border-purple-500/30">
    <span className="text-purple-400 text-xs font-medium">🎨 Studio</span>
    
    {/* اختيار نسبة العرض */}
    <select className="bg-[#2a2f32] text-white text-xs rounded px-2 py-1">
      <option value="1:1">مربع 1:1</option>
      <option value="3:4">عمودي 3:4</option>
      <option value="4:3">أفقي 4:3</option>
      <option value="9:16">ستوري 9:16</option>
      <option value="16:9">سينمائي 16:9</option>
    </select>
    
    {/* اختيار الأسلوب */}
    <select className="bg-[#2a2f32] text-white text-xs rounded px-2 py-1">
      <option value="realistic">واقعي</option>
      <option value="cartoon">كرتوني</option>
      <option value="anime">أنمي</option>
      <option value="oil_painting">زيتي</option>
      <option value="cinematic">سينمائي</option>
      <option value="digital_art">رقمي</option>
    </select>
    
    <button onClick={() => setAppMode('CHAT')} className="ml-auto text-gray-400 text-xs">✕ إغلاق</button>
  </div>
)}
```

**3. تغيير placeholder حقل الإدخال:**
```diff
 placeholder={
   appMode === 'IMAGE_GEN' ? 'وصف السيلفي...' :
+  appMode === 'STUDIO' ? '✨ اوصف الصورة اللي تبيها...' :
   'اكتب رسالة...'
 }
```

**4. تأثير بصري عند تفعيل Studio:**
```diff
 className={`... ${
   appMode === 'IMAGE_GEN' ? 'ring-1 ring-purple-500' :
+  appMode === 'STUDIO' ? 'ring-2 ring-gradient-to-r from-purple-500 to-pink-500 shadow-lg shadow-purple-500/20' :
   ''
 }`}
```

---

#### [MODIFY] [ChatBubble.tsx](file:///Users/mamdouhaboammar/Downloads/رفيق%20للنشر%20والاختبار/components/ChatBubble.tsx)

تحسين عرض الصور المولّدة بالـ Studio:

```tsx
{/* إضافة شارة "Studio" على الصور المولّدة */}
{imageAttachments.map((att, i) => (
  <div key={i} className="relative rounded-lg overflow-hidden bg-black/5 group">
    <img 
      src={att.previewUrl} 
      alt="attachment" 
      className="max-w-full h-auto object-cover cursor-pointer"
      onClick={() => openImageViewer(att.previewUrl)} // فتح بحجم كامل
    />
    {att.fileName?.startsWith('studio-') && (
      <span className="absolute top-2 right-2 bg-purple-500/80 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur">
        🎨 Studio
      </span>
    )}
    {/* زر التحميل */}
    <button 
      className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 text-white p-1.5 rounded-full"
      onClick={() => downloadImage(att.previewUrl, att.fileName)}
    >
      ⬇️
    </button>
  </div>
))}
```

---

### المكون 5 (اختياري): PersonaEngine Integration

---

#### [MODIFY] [personaEngine.ts](file:///Users/mamdouhaboammar/Downloads/رفيق%20للنشر%20والاختبار/services/personaEngine.ts)

إضافة تعليمات للبوت حول بروتوكول توليد الصور:

```diff
 // في بناء الـ system prompt — قسم البروتوكولات
+## بروتوكول توليد الصور
+إذا المستخدم طلب منك تولّد صورة (مش سيلفي)، اكتب الوصف داخل الوسم التالي:
+[[GENERATE_IMAGE: وصف تفصيلي بالإنجليزية للصورة المطلوبة]]
+مثال: المستخدم يقول "ولّدلي صورة غروب على البحر"
+الرد: أكيد هالحظة! 🎨
+[[GENERATE_IMAGE: A stunning sunset over the ocean, golden hour lighting, calm waves reflecting orange and purple sky, photorealistic]]
```

---

## خطة التحقق

### اختبارات تلقائية
```bash
# 1. تشغيل السيرفر محلياً
npm run dev

# 2. اختبار RPC endpoint مباشرة
curl -X POST http://localhost:3000/api/gemini \
  -H "Content-Type: application/json" \
  -d '{"action":"generateStudioImage","args":["a beautiful sunset over the ocean",{"aspectRatio":"16:9","size":"2K","style":"cinematic"}]}'

# 3. التحقق من TypeScript
npx tsc --noEmit
```

### تحقق يدوي
1. فتح محادثة → الضغط على زر Studio → كتابة وصف → التحقق من ظهور الصورة
2. تغيير نسبة العرض والأسلوب → التحقق من التأثير
3. اختبار بروتوكول `[[GENERATE_IMAGE:...]]` بطلب صورة من البوت في الشات العادي
4. اختبار الـ fallback عند فشل النموذج الأول
5. اختبار على الموبايل — التأكد من responsive design
