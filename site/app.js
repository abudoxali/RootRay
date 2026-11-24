/**
 * RootRay Showcase & Benchmark Engine
 * Bilingual (EN/AR), Interactive Benchmarks & Workbench Simulator
 */

const BENCHMARKS_DATA = {
  installer: {
    titleEn: "Installer / Download Size",
    titleAr: "حجم ملف التثبيت / التحميل",
    descEn: "Ultra-compact native packaging vs bloated Electron runtimes.",
    descAr: "حزم أصلية فائقة الصغر مقارنة مع بيئات Electron الضخمة.",
    items: [
      { name: "RootRay v0.3.0 (Rust + NSIS)", value: "2.45 MB", width: "3%", highlight: true, noteEn: "Complete desktop tool with WebView2", noteAr: "الأداة الكاملة مع دعم WebView2" },
      { name: "VS Code Windows x64 Installer", value: "95 MB", width: "42%", highlight: false, noteEn: "Editor base setup", noteAr: "المحرر الأساسي فقط" },
      { name: "Typical Electron Developer Tool", value: "165 MB", width: "75%", highlight: false, noteEn: "Full Chromium + Node runtime bundled", noteAr: "يحتوي على متصفح كامل مع بيئة نود" },
      { name: "Desktop Web IDE Bundle", value: "220 MB", width: "100%", highlight: false, noteEn: "Heavy multi-process stack", noteAr: "حزمة ثقيلة متعددة العمليات" }
    ]
  },
  startup: {
    titleEn: "Cold Startup Time to Ready UI",
    titleAr: "سرعة الإقلاع البارد (Cold Startup)",
    descEn: "Time from double-click to fully interactive and responsive workbench.",
    descAr: "الوقت من لحظة فتح البرنامج حتى جاهزية بيئة العمل التامة.",
    items: [
      { name: "RootRay v0.3.0", value: "175 ms", width: "6%", highlight: true, noteEn: "Native Rust AppCore + lazy chunks", noteAr: "نواة Rust أصلية مع تحميل ذكي للأجزاء" },
      { name: "Lightweight Code Editor", value: "850 ms", width: "28%", highlight: false, noteEn: "Warm startup with few plugins", noteAr: "محرر خفيف مع إضافات قليلة" },
      { name: "VS Code + React DevTools", value: "2,400 ms", width: "72%", highlight: false, noteEn: "Loading extensions, workspace scan", noteAr: "تحميل الإضافات وفحص مساحة العمل" },
      { name: "Heavy IDE + Embedded Browser", value: "3,600 ms", width: "100%", highlight: false, noteEn: "Multi-process orchestration", noteAr: "بدء عدة عمليات متزامنة" }
    ]
  },
  memory: {
    titleEn: "Idle Memory Footprint (RAM)",
    titleAr: "استهلاك الذاكرة العشوائية (RAM) في وضع الخمول",
    descEn: "Resource footprint when watching project and rendering Preview.",
    descAr: "حجم الموارد المستهلكة أثناء مراقبة المشروع وعرض المعاينة.",
    items: [
      { name: "RootRay Integrated Workbench", value: "48 MB", width: "8%", highlight: true, noteEn: "Single shared memory boundary", noteAr: "استهلاك مدمج خفيف داخل عملية موحدة" },
      { name: "VS Code Alone", value: "280 MB", width: "45%", highlight: false, noteEn: "Base editor + TypeScript server", noteAr: "المحرر مع خادم تايب سكريبت" },
      { name: "Chrome + DevTools + Project Tab", value: "420 MB", width: "68%", highlight: false, noteEn: "Browser engine + DevTools inspection", noteAr: "متصفح كروم وأدوات الفحص المفتوحة" },
      { name: "Separate IDE + Separate Chrome", value: "700 MB", width: "100%", highlight: false, noteEn: "Two heavy separate applications", noteAr: "تطبيقان منفصلان كلاهما يستهلك الذاكرة" }
    ]
  },
  inspector: {
    titleEn: "In-Page Injected Inspector Footprint",
    titleAr: "حجم السكربت المحقون داخل صفحة المعاينة",
    descEn: "Payload added to your running dev server for UI-to-source mapping.",
    descAr: "الحجم المحقون داخل سيرفر التطوير لربط الواجهة بالمصدر.",
    items: [
      { name: "RootRay In-Page Runtime", value: "12 KB", width: "2%", highlight: true, noteEn: "Zero overhead, authenticated loopback WS", noteAr: "بدون أي إبطاء، اتصال WS محلي محمي" },
      { name: "React Developer Tools Hook", value: "480 KB", width: "35%", highlight: false, noteEn: "Component fiber tree tracker", noteAr: "تتبع شجرة الفايبر للمكونات" },
      { name: "Generic DevTools Extension Pack", value: "1,400 KB", width: "100%", highlight: false, noteEn: "Heavy DOM mutation observers", noteAr: "مراقبة ثقيلة لتغيرات الـ DOM" }
    ]
  },
  discovery: {
    titleEn: "Workspace Discovery (8,300 Files)",
    titleAr: "سرعة فحص واكتشاف مساحة العمل (8,300 ملف)",
    descEn: "Bounded native filesystem traversal and capability analysis.",
    descAr: "فحص المسارات واكتشاف قدرات أطر العمل بآليات Rust الأصلية.",
    items: [
      { name: "RootRay Native Bounded Walker", value: "1.02 s", width: "15%", highlight: true, noteEn: "Parallel Rust walk, capped results", noteAr: "مسح فائق السرعة بلغة Rust بحدود ذكية" },
      { name: "Standard Node.js glob / walker", value: "4.80 s", width: "70%", highlight: false, noteEn: "JavaScript event-loop I/O", noteAr: "قراءة جافاسكربت عبر Event Loop" },
      { name: "Unoptimized Electron Directory Scan", value: "6.90 s", width: "100%", highlight: false, noteEn: "Blocks UI renderer thread", noteAr: "يعطل واجهة المستخدم أثناء القراءة" }
    ]
  }
};

const SIMULATOR_TARGETS = {
  button: {
    selector: "<CTAButton />",
    component: "CTAButton",
    file: "src/components/CTAButton.tsx",
    line: 14,
    col: 8,
    tag: "button.btn-primary",
    styles: "display: inline-flex; background: #ff7a18; border-radius: 8px; font-weight: 700;",
    codeHighlight: 14,
    lines: [
      { num: 10, content: 'import React from "react";' },
      { num: 11, content: 'import styles from "./CTAButton.module.css";' },
      { num: 12, content: '' },
      { num: 13, content: 'export const CTAButton = ({ label, onClick }: Props) => {' },
      { num: 14, content: '  return (', hl: true },
      { num: 15, content: '    <button className={styles.btnPrimary} onClick={onClick}>', hl: true },
      { num: 16, content: '      {label} →', hl: true },
      { num: 17, content: '    </button>', hl: true },
      { num: 18, content: '  );' },
      { num: 19, content: '};' }
    ]
  },
  metric: {
    selector: "<PerformanceMetricCard />",
    component: "PerformanceMetricCard",
    file: "src/features/dashboard/PerformanceMetricCard.tsx",
    line: 28,
    col: 5,
    tag: "div.metric-card-root",
    styles: "padding: 1.25rem; background: #141b26; border: 1px solid #ff7a18; border-radius: 12px;",
    codeHighlight: 28,
    lines: [
      { num: 24, content: 'export function PerformanceMetricCard({ title, value, unit }: Props) {' },
      { num: 25, content: '  const formatted = useMemo(() => formatValue(value), [value]);' },
      { num: 26, content: '' },
      { num: 27, content: '  return (' },
      { num: 28, content: '    <div className="metric-card-root" data-testid="metric">', hl: true },
      { num: 29, content: '      <h4 className="text-secondary">{title}</h4>', hl: true },
      { num: 30, content: '      <span className="text-accent">{formatted} {unit}</span>', hl: true },
      { num: 31, content: '    </div>', hl: true },
      { num: 32, content: '  );' },
      { num: 33, content: '}' }
    ]
  },
  header: {
    selector: "<ProjectHeader />",
    component: "ProjectHeader",
    file: "src/components/layout/ProjectHeader.tsx",
    line: 8,
    col: 3,
    tag: "header.workbench-header",
    styles: "height: 64px; display: flex; align-items: center; justify-content: space-between;",
    codeHighlight: 8,
    lines: [
      { num: 5, content: 'export const ProjectHeader: React.FC<HeaderProps> = ({ title }) => {' },
      { num: 6, content: '  const { activeWorkspace } = useWorkspace();' },
      { num: 7, content: '' },
      { num: 8, content: '  return (', hl: true },
      { num: 9, content: '    <header className="workbench-header">', hl: true },
      { num: 10, content: '      <Logo size={32} />', hl: true },
      { num: 11, content: '      <h1 className="title">{title}</h1>', hl: true },
      { num: 12, content: '    </header>', hl: true },
      { num: 13, content: '  );' },
      { num: 14, content: '};' }
    ]
  }
};

let currentLocale = "ar"; // Default Arabic for the user's requirement, toggleable to EN
let currentBenchTab = "installer";

document.addEventListener("DOMContentLoaded", () => {
  initLanguage();
  initBenchmarks();
  initSimulator();
  initFaq();
  initCopyActions();
});

// Language Management
function initLanguage() {
  const saved = localStorage.getItem("rootray_lang");
  if (saved && (saved === "ar" || saved === "en")) {
    currentLocale = saved;
  }
  applyLocale(currentLocale);

  const langBtn = document.getElementById("lang-toggle");
  if (langBtn) {
    langBtn.addEventListener("click", () => {
      currentLocale = currentLocale === "ar" ? "en" : "ar";
      localStorage.setItem("rootray_lang", currentLocale);
      applyLocale(currentLocale);
      renderBenchmarks(currentBenchTab);
    });
  }
}

function applyLocale(locale) {
  const isAr = locale === "ar";
  document.documentElement.lang = isAr ? "ar" : "en";
  document.documentElement.dir = isAr ? "rtl" : "ltr";

  // Toggle button label
  const langLabel = document.getElementById("lang-label");
  if (langLabel) {
    langLabel.textContent = isAr ? "English" : "العربية";
  }

  // Swap all elements with data-en and data-ar
  document.querySelectorAll("[data-en][data-ar]").forEach(el => {
    el.textContent = isAr ? el.getAttribute("data-ar") : el.getAttribute("data-en");
  });

  // Swap placeholders
  document.querySelectorAll("[data-en-placeholder][data-ar-placeholder]").forEach(el => {
    el.placeholder = isAr ? el.getAttribute("data-ar-placeholder") : el.getAttribute("data-en-placeholder");
  });
}

// Benchmarks Management
function initBenchmarks() {
  const tabButtons = document.querySelectorAll(".bench-tab-btn");
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      tabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentBenchTab = btn.getAttribute("data-metric");
      renderBenchmarks(currentBenchTab);
    });
  });

  renderBenchmarks(currentBenchTab);
}

function renderBenchmarks(metricKey) {
  const data = BENCHMARKS_DATA[metricKey];
  if (!data) return;

  const isAr = currentLocale === "ar";
  const titleEl = document.getElementById("bench-metric-title");
  const descEl = document.getElementById("bench-metric-desc");
  const listEl = document.getElementById("bench-card-list");

  if (titleEl) titleEl.textContent = isAr ? data.titleAr : data.titleEn;
  if (descEl) descEl.textContent = isAr ? data.descAr : data.descEn;

  if (listEl) {
    listEl.innerHTML = "";
    data.items.forEach(item => {
      const row = document.createElement("div");
      row.className = `bench-row ${item.highlight ? "highlight" : ""}`;
      
      const fillColor = item.highlight ? "fill-orange" : (item.width === "100%" ? "fill-red" : "fill-gray");
      const note = isAr ? item.noteAr : item.noteEn;

      row.innerHTML = `
        <div class="bench-row-header">
          <span class="bench-tool-name">
            ${item.highlight ? "⚡" : "📦"} ${item.name}
          </span>
          <span class="bench-value">${item.value}</span>
        </div>
        <div class="bench-bar-track">
          <div class="bench-bar-fill ${fillColor}" style="width: 0%;"></div>
        </div>
        <div class="bench-note">${note}</div>
      `;

      listEl.appendChild(row);

      // Animate width
      setTimeout(() => {
        const fill = row.querySelector(".bench-bar-fill");
        if (fill) fill.style.width = item.width;
      }, 50);
    });
  }
}

// Simulator Management
function initSimulator() {
  const cards = document.querySelectorAll(".sample-ui-card");
  cards.forEach(card => {
    card.addEventListener("click", () => {
      const targetKey = card.getAttribute("data-target");
      if (SIMULATOR_TARGETS[targetKey]) {
        cards.forEach(c => c.classList.remove("active-target"));
        card.classList.add("active-target");
        updateSimulator(SIMULATOR_TARGETS[targetKey]);
      }
    });
  });

  // Init with default button target
  updateSimulator(SIMULATOR_TARGETS.button);
}

function updateSimulator(target) {
  const codeEditor = document.getElementById("sim-code-editor");
  const insComponent = document.getElementById("ins-component");
  const insFile = document.getElementById("ins-file");
  const insLocation = document.getElementById("ins-location");
  const insTag = document.getElementById("ins-tag");
  const insStyles = document.getElementById("ins-styles");

  if (insComponent) insComponent.textContent = target.component;
  if (insFile) insFile.textContent = target.file;
  if (insLocation) insLocation.textContent = `L${target.line} : C${target.col}`;
  if (insTag) insTag.textContent = target.tag;
  if (insStyles) insStyles.textContent = target.styles;

  if (codeEditor) {
    codeEditor.innerHTML = "";
    target.lines.forEach(line => {
      const lineDiv = document.createElement("div");
      lineDiv.className = `code-line ${line.hl ? "highlighted" : ""}`;
      lineDiv.innerHTML = `
        <span class="line-num">${line.num || ""}</span>
        <span class="line-content">${escapeHtml(line.content)}</span>
      `;
      codeEditor.appendChild(lineDiv);
    });
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// FAQ Accordion
function initFaq() {
  const faqItems = document.querySelectorAll(".faq-item");
  faqItems.forEach(item => {
    const qBtn = item.querySelector(".faq-question");
    if (qBtn) {
      qBtn.addEventListener("click", () => {
        const isOpen = item.classList.contains("open");
        faqItems.forEach(i => i.classList.remove("open"));
        if (!isOpen) item.classList.add("open");
      });
    }
  });
}

// Copy to Clipboard Helpers
function initCopyActions() {
  const copyHashBtn = document.getElementById("btn-copy-hash");
  if (copyHashBtn) {
    copyHashBtn.addEventListener("click", () => {
      const hash = "ebee47faef50d485b227995c4a8ce4c4c39dab06167858c9fd5523f20e5a95e3";
      navigator.clipboard.writeText(hash).then(() => {
        showToast(currentLocale === "ar" ? "تم نسخ كود الهاش SHA-256 بنجاح!" : "SHA-256 Hash copied to clipboard!");
      });
    });
  }

  const copyPsBtn = document.getElementById("btn-copy-ps");
  if (copyPsBtn) {
    copyPsBtn.addEventListener("click", () => {
      const psCmd = `Get-FileHash .\\RootRay_0.3.0_x64-setup.exe -Algorithm SHA256`;
      navigator.clipboard.writeText(psCmd).then(() => {
        showToast(currentLocale === "ar" ? "تم نسخ أمر PowerShell للتحقق!" : "PowerShell verify command copied!");
      });
    });
  }
}

function showToast(message) {
  let toast = document.getElementById("toast-notice");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast-notice";
    toast.className = "toast-notice";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}
