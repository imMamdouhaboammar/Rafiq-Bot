# 📎 خطة إضافة ميزة رفع الملفات وتحليلها في رفيق

> **التاريخ:** 19 مايو 2026  
> **الحالة:** مقترح — في انتظار الموافقة  
> **الأولوية:** عالية

---

## 📌 الهدف

إضافة ميزة **رفع ملفات متنوعة** في الشات (PDF، Word، Excel، TXT، CSV، JSON، أكواد برمجية، صور، صوت) بحيث يقدر البوت **يقرأها ويحللها ويرد عليها** بأسلوبه الطبيعي.

---

## 🏗️ الوضع الحالي (تحليل الكود)

### ✅ موجود بالفعل:
| الميزة | التفاصيل |
|---|---|
| رفع صور | `ChatInterface.tsx` → زر Upload Photo يقبل `image/*` فقط |
| Voice Recording | تسجيل صوتي + إرساله كـ `audio/webm` |
| Import Chat (.txt) | استيراد محادثة واتساب كملف نصي |
| Attachment Schema | `types.ts` → `AttachmentSchema` يدعم `file`, `mimeType`, `previewUrl`, `base64` |
| Inline Data → Gemini | `geminiService.server.ts` → يرسل attachments كـ `inlineData` لـ Gemini |
| File → Base64 | `geminiService.ts` → `fileToGenAIInlineData()` يحول أي `File` لـ base64 |

### ❌ غير موجود:
| الميزة | التفاصيل |
|---|---|
| زر رفع ملفات عام | الزر الحالي محدود بـ `accept="image/*"` |
| معالجة PDF/DOCX/XLSX | لا يوجد parser يستخرج النص من هذه الملفات |
| عرض الملفات في الفقاعة | `ChatBubble.tsx` يعرض صور وصوت فقط، لا يعرض ملفات |
| حد حجم الملفات | لا يوجد validation على حجم الملف |
| معالجة server-side للملفات | الملفات تُرسل كـ base64 inline فقط — لا يوجد endpoint مخصص |

---

## 📋 خطة التنفيذ المفصلة

### المرحلة 1: البنية التحتية (Backend)

#### 1.1 إضافة مكتبات استخراج النصوص

```bash
npm install pdf-parse mammoth xlsx
```

| المكتبة | الاستخدام |
|---|---|
| `pdf-parse` | استخراج النص من PDF |
| `mammoth` | تحويل DOCX → HTML/Text |
| `xlsx` | قراءة ملفات Excel و CSV |

#### 1.2 إنشاء ملف جديد: `services/fileProcessor.server.ts`

هذا الملف يكون المعالج المركزي لكل أنواع الملفات:

```typescript
// services/fileProcessor.server.ts

interface ProcessedFile {
  originalName: string;
  mimeType: string;
  extractedText: string;     // النص المستخرج
  metadata: {                 // معلومات الملف
    pages?: number;
    words?: number;
    sheets?: string[];
    language?: string;
  };
  truncated: boolean;         // هل تم اقتطاع النص؟
}

export async function processFile(
  base64Data: string, 
  mimeType: string, 
  fileName: string
): Promise<ProcessedFile>
```

**أنواع الملفات المدعومة:**

| النوع | MIME Type | طريقة المعالجة |
|---|---|---|
| PDF | `application/pdf` | `pdf-parse` → استخراج النص |
| Word (.docx) | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `mammoth` → تحويل لنص |
| Word (.doc) | `application/msword` | `mammoth` → تحويل لنص |
| Excel (.xlsx) | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | `xlsx` → تحويل كل sheet لـ CSV text |
| CSV | `text/csv` | قراءة مباشرة كنص |
| JSON | `application/json` | قراءة مباشرة + pretty print |
| TXT | `text/plain` | قراءة مباشرة |
| Markdown | `text/markdown` | قراءة مباشرة |
| أكواد برمجية | `text/javascript`, `text/python`, etc. | قراءة مباشرة + تحديد اللغة |
| صور | `image/*` | تمرير مباشر لـ Gemini Vision (الوضع الحالي) |
| صوت | `audio/*` | تمرير مباشر لـ Gemini (الوضع الحالي) |

**ملاحظة مهمة:** Gemini يدعم **نيتيڤ** قراءة الصور والصوت — فلا حاجة لمعالجتها. المعالجة فقط للملفات النصية/المستندات.

#### 1.3 إضافة API Endpoint جديد أو تعديل الحالي

**الخيار المقترح:** إضافة action جديد `processFileForChat` في نفس الـ RPC pattern الموجود:

```typescript
// في geminiService.server.ts — إضافة function جديدة
export const processFileForChat = async (
  base64Data: string,
  mimeType: string,
  fileName: string
): Promise<ProcessedFile>
```

وتسجيلها في `api/gemini.ts`:
```typescript
processFileForChat: GeminiServerService.processFileForChat,
```

#### 1.4 تعديل `sendMessageToGemini` لدعم الملفات المعالَجة

إضافة parameter جديد `fileContext` في الـ function:

```typescript
export const sendMessageToGemini = async (
  history, newMessage, attachments,
  useThinking, settings, userProfile, psychology,
  groupContext?, externalContext?, replyContext?,
  allowSearch?, routeHint?, memoryScopeId?,
  fileContexts?: ProcessedFile[]  // ← جديد
) => {
  // دمج النصوص المستخرجة في prompt
  if (fileContexts?.length) {
    const fileSection = fileContexts.map(f => 
      `📎 [ملف: ${f.originalName}]\n${f.extractedText}`
    ).join('\n\n');
    finalUserText = `${fileSection}\n\n${finalUserText}`;
  }
}
```

---

### المرحلة 2: الفرونت إند (واجهة المستخدم)

#### 2.1 تعديل `types.ts` — توسيع AttachmentSchema

```typescript
export const AttachmentSchema = z.object({
  file: z.any().optional(),
  mimeType: z.string(),
  previewUrl: z.string(),
  base64: z.string().optional(),
  // ← جديد
  fileName: z.string().optional(),
  fileSize: z.number().optional(),
  extractedText: z.string().optional(),  // النص المستخرج من الملف
  fileType: z.enum([
    'image', 'audio', 'video',
    'pdf', 'document', 'spreadsheet',
    'code', 'text', 'other'
  ]).optional(),
});
```

#### 2.2 تعديل `ChatInterface.tsx` — إضافة زر رفع ملفات عام

في قائمة المرفقات (`showAttachMenu`):

```tsx
// زر جديد في Attach Menu
<label className="flex cursor-pointer items-center gap-2 rounded-lg p-2.5 text-sm hover:bg-[#f0f2f5]">
    <Paperclip size={16} className="text-orange-500"/>ملف (PDF, Word, Excel...)
    <input 
      type="file" 
      onChange={(e) => { chatCtrl.handleFileUpload(e); setShowAttachMenu(false); }} 
      className="hidden" 
      accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.json,.txt,.md,.py,.js,.ts,.html,.css,.java,.cpp,.c,.swift,.kt,.go,.rs,.rb,.php,.sql,.xml,.yaml,.yml"
    />
</label>
```

#### 2.3 تعديل `useChatController.ts` — إضافة handleFileUpload

```typescript
const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  
  // 1. Validation
  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
  if (file.size > MAX_FILE_SIZE) {
    eventBus.emit('ui:toast', { message: 'حجم الملف كبير أوي (الحد الأقصى 20MB)', type: 'error' });
    return;
  }
  
  // 2. تحويل لـ Base64
  const { data } = await GeminiService.fileToGenAIInlineData(file);
  
  // 3. تحديد نوع الملف
  const fileType = classifyFileType(file.type, file.name);
  
  // 4. إنشاء preview URL مناسب
  const previewUrl = file.type.startsWith('image') 
    ? URL.createObjectURL(file) 
    : `file-icon://${fileType}`;
  
  // 5. إضافة للمرفقات
  setAttachments(prev => [...prev, {
    file,
    mimeType: file.type,
    previewUrl,
    base64: data,
    fileName: file.name,
    fileSize: file.size,
    fileType,
  }]);
};
```

#### 2.4 تعديل `ChatBubble.tsx` — عرض الملفات في فقاعة الشات

إضافة عنصر جديد لعرض الملفات غير الصور/الصوت:

```tsx
{/* ═══ File Attachments (non-image, non-audio) ═══ */}
{fileAttachments.length > 0 && (
  <div className="flex flex-col gap-1 mb-1">
    {fileAttachments.map((att, i) => (
      <div key={i} className="flex items-center gap-2 bg-black/5 rounded-lg p-2 min-w-[200px]">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-400 to-red-500 
                        flex items-center justify-center text-white text-xs font-bold shrink-0">
          {getFileExtension(att.fileName)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-[#111b21] truncate">{att.fileName}</p>
          <p className="text-[11px] text-[#667781]">{formatFileSize(att.fileSize)}</p>
        </div>
      </div>
    ))}
  </div>
)}
```

#### 2.5 تعديل preview المرفقات في شريط الإدخال

في `ChatInterface.tsx`، تحسين عرض المرفقات في الـ input bar:

```tsx
{chatCtrl.attachments.map((a, i) => (
  <div key={i} className="w-10 h-10 rounded overflow-hidden relative shrink-0 border border-gray-200">
    {a.mimeType.startsWith('image') ? (
      <img src={a.previewUrl} className="w-full h-full object-cover" />
    ) : a.mimeType.startsWith('audio') ? (
      <div className="w-full h-full bg-purple-100 flex items-center justify-center">
        <Mic size={14} className="text-purple-600"/>
      </div>
    ) : (
      // ← جديد: أيقونة ملف
      <div className="w-full h-full bg-orange-100 flex items-center justify-center">
        <FileText size={14} className="text-orange-600"/>
      </div>
    )}
    {/* زر حذف المرفق */}
    <button onClick={() => chatCtrl.removeAttachment(i)} 
            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full 
                       flex items-center justify-center text-[10px]">×</button>
  </div>
))}
```

---

### المرحلة 3: تدفق إرسال الملف (Flow)

```
┌────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   المستخدم      │    │   Frontend        │    │   Backend (Server)   │
│  يرفع ملف      │───▶│  File → Base64    │───▶│  processFile()       │
│                │    │  + validation     │    │  ↓                   │
│                │    │  + preview        │    │  PDF→text / DOCX→text│
│  يكتب رسالة    │───▶│  handleSend()     │───▶│  ↓                   │
│  ويضغط إرسال   │    │  ↓                │    │  النص المستخرج       │
│                │    │  attachments +    │    │  يُدمج في prompt     │
│                │    │  text → API       │    │  → Gemini API        │
│                │    │                  │    │  ↓                   │
│  يستلم الرد    │◀───│  bot message      │◀───│  الرد + تحليل الملف  │
└────────────────┘    └──────────────────┘    └─────────────────────┘
```

**تدفق مفصل:**

1. المستخدم يضغط 📎 → يختار "ملف" → يختار ملف من جهازه
2. **Frontend Validation:**
   - التحقق من الحجم (≤ 20MB)
   - التحقق من النوع (أنواع مدعومة)
3. **تحويل لـ Base64** عبر `FileReader`
4. **عرض Preview** في شريط الإدخال (أيقونة + اسم الملف)
5. المستخدم يكتب رسالة (اختياري) ويضغط إرسال
6. **رسالة المستخدم** تُحفظ في DB مع المرفق
7. **إرسال للـ Server** — أول شيء يحصل:
   - إذا الملف **صورة/صوت**: يتم تمريره مباشرة لـ Gemini كـ `inlineData` (الطريقة الحالية)
   - إذا الملف **مستند** (PDF/DOCX/XLSX/etc): 
     - يُمعالج بالـ `fileProcessor` لاستخراج النص
     - النص المستخرج يُضاف في prompt مع رسالة المستخدم
     - يُرسل لـ Gemini كنص
8. **Gemini يرد** — الرد يُعرض في الشات

---

### المرحلة 4: تفاصيل التنفيذ التقنية

#### 4.1 معالجة الملفات الكبيرة

```typescript
const MAX_EXTRACTED_TEXT_LENGTH = 30_000; // ~30K characters max

function truncateText(text: string, maxLen: number): { text: string; truncated: boolean } {
  if (text.length <= maxLen) return { text, truncated: false };
  return {
    text: text.slice(0, maxLen) + '\n\n[... تم اقتطاع باقي الملف — الملف طويل أوي]',
    truncated: true,
  };
}
```

#### 4.2 تحديد نوع الملف

```typescript
function classifyFileType(mimeType: string, fileName: string): AttachmentFileType {
  if (mimeType.startsWith('image')) return 'image';
  if (mimeType.startsWith('audio')) return 'audio';
  if (mimeType.startsWith('video')) return 'video';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'document';
  if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType === 'text/csv') return 'spreadsheet';
  
  const ext = fileName.split('.').pop()?.toLowerCase();
  const codeExtensions = ['js','ts','tsx','jsx','py','java','cpp','c','swift','kt','go','rs','rb','php','sql','html','css','xml','yaml','yml'];
  if (codeExtensions.includes(ext || '')) return 'code';
  
  return 'text';
}
```

#### 4.3 قائمة الملفات المدعومة

| التصنيف | الامتدادات | الحد الأقصى للحجم |
|---|---|---|
| 📄 مستندات | `.pdf`, `.doc`, `.docx` | 20MB |
| 📊 جداول بيانات | `.xlsx`, `.xls`, `.csv` | 10MB |
| 📝 نصوص | `.txt`, `.md`, `.json`, `.xml`, `.yaml` | 5MB |
| 💻 أكواد | `.js`, `.ts`, `.py`, `.java`, `.cpp`, `.swift`, etc. | 5MB |
| 🖼️ صور | `.jpg`, `.png`, `.gif`, `.webp` | 20MB (يتعامل معها Gemini مباشرة) |
| 🎵 صوت | `.mp3`, `.wav`, `.webm`, `.ogg` | 20MB (يتعامل معها Gemini مباشرة) |

---

## 📁 الملفات المتأثرة

### ملفات جديدة:
| الملف | الوصف |
|---|---|
| `services/fileProcessor.server.ts` | معالجة واستخراج النصوص من الملفات |

### ملفات معدّلة:
| الملف | التعديل |
|---|---|
| `types.ts` | توسيع `AttachmentSchema` بـ `fileName`, `fileSize`, `fileType`, `extractedText` |
| `components/ChatInterface.tsx` | إضافة زر رفع ملفات + تحسين preview المرفقات |
| `components/ChatBubble.tsx` | إضافة عرض الملفات (غير صور/صوت) في الفقاعة |
| `hooks/useChatController.ts` | إضافة `handleFileUpload` + `removeAttachment` + تعديل `handleSend` |
| `services/geminiService.ts` | إضافة `processFileForChat` RPC |
| `services/geminiService.server.ts` | إضافة `processFileForChat` + تعديل `sendMessageToGemini` |
| `api/gemini.ts` | تسجيل action `processFileForChat` |
| `package.json` | إضافة dependencies: `pdf-parse`, `mammoth`, `xlsx` |

---

## ⚠️ نقاط مهمة

### الأمان:
- **حد الحجم**: 20MB كحد أقصى لكل ملف
- **Validation مزدوج**: Frontend + Backend
- **أنواع محددة فقط**: whitelist بدل blacklist
- **تنظيف النصوص**: إزالة أي محتوى خطير قبل إرساله لـ Gemini

### الأداء:
- **تحويل Base64** يزيد الحجم ~33% — مهم نراعي حد الـ payload (السيرفر حاليًا يقبل `50mb`)
- **PDF كبير** ممكن يبطئ — لازم نحدد `MAX_EXTRACTED_TEXT_LENGTH`
- **Memory**: الملفات المعالجة تُفرغ من الذاكرة بعد الاستخراج

### تجربة المستخدم:
- **Loading indicator** واضح أثناء معالجة الملف
- **رسالة خطأ** واضحة لو الملف مش مدعوم أو كبير
- **عرض اسم الملف + حجمه** في فقاعة الشات
- **Drag & Drop** (ميزة مستقبلية — مش في الخطة الحالية)

---

## 🔮 ميزات مستقبلية (خارج هذه الخطة)

- [ ] **Drag & Drop** — سحب وإفلات الملفات على الشات
- [ ] **رفع ملفات متعددة** في نفس الرسالة
- [ ] **تحليل ملفات ZIP** — فك الضغط وتحليل المحتوى
- [ ] **OCR للصور** — استخراج نص من صور (Gemini يدعمها نيتيڤ)
- [ ] **Preview للملفات** — عرض محتوى PDF/Excel في popup

---

## ✅ خطة التحقق

1. رفع ملف PDF → التأكد من استخراج النص + رد البوت
2. رفع ملف DOCX → نفس التحقق
3. رفع ملف Excel → التأكد من قراءة كل الـ sheets
4. رفع ملف CSV → التأكد من قراءة البيانات
5. رفع ملف كود (.py/.js) → التأكد من قراءة الكود + تحليله
6. رفع ملف JSON → التأكد من قراءته + تحليل البنية
7. رفع صورة → التأكد إن الـ flow الحالي لسه شغال
8. رفع ملف كبير (>20MB) → التأكد من رسالة الخطأ
9. رفع نوع غير مدعوم → التأكد من رسالة الخطأ
10. رفع ملف + كتابة رسالة → التأكد من دمج الاثنين

---

## 📅 الترتيب المقترح للتنفيذ

1. ⬜ تثبيت المكتبات (`pdf-parse`, `mammoth`, `xlsx`)
2. ⬜ إنشاء `services/fileProcessor.server.ts`
3. ⬜ تعديل `types.ts` (توسيع AttachmentSchema)
4. ⬜ تعديل `geminiService.server.ts` (إضافة processFileForChat + تعديل sendMessageToGemini)
5. ⬜ تعديل `api/gemini.ts` (تسجيل action جديد)
6. ⬜ تعديل `geminiService.ts` (client RPC)
7. ⬜ تعديل `useChatController.ts` (handleFileUpload + تعديل handleSend)
8. ⬜ تعديل `ChatInterface.tsx` (UI رفع ملفات + preview)
9. ⬜ تعديل `ChatBubble.tsx` (عرض الملفات في الفقاعة)
10. ⬜ اختبار شامل
