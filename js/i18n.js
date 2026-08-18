const translations = {
  en: {
    'dashboard.subtitle': 'Inspect UVs, paint textures and keep local project history.',
    'dashboard.trash': 'Trash',
    'dashboard.newProject': 'New Project',
    'dashboard.localFirst': 'LOCAL FIRST',
    'dashboard.heroTitle': 'See exactly where your model reads its texture.',
    'dashboard.heroBody': 'Load a model, click a surface, inspect the matching UV area and edit the texture with live 3D feedback.',
    'dashboard.loadModel': 'Load 3D Model',
    'dashboard.recentProjects': 'Recent Projects',
    'dashboard.recentHint': 'Projects stay in this browser unless site data is cleared.',
    'dashboard.emptyTitle': 'No local projects yet',
    'dashboard.emptyBody': 'Load a model to start inspecting UVs and editing textures.',
    'top.loadModel': 'Load Model',
    'top.loadTexture': 'Load Texture',
    'top.exportTexture': 'Export Texture',
    'top.exportModel': 'Export Model',
    'panel.tool': 'Tool',
    'panel.scene': 'Scene',
    'panel.layers': 'Layers',
    'panel.activeTool': 'Active Tool',
    'panel.color': 'Color',
    'viewport.dropModel': 'Drop a 3D model here',
  },
  tr: {
    'dashboard.subtitle': 'UV bölgelerini incele, texture boya ve proje geçmişini tarayıcıda tut.',
    'dashboard.trash': 'Çöp Kutusu',
    'dashboard.newProject': 'Yeni Proje',
    'dashboard.localFirst': 'YEREL ÇALIŞIR',
    'dashboard.heroTitle': 'Modelinin texture üzerinde tam olarak nereyi kullandığını gör.',
    'dashboard.heroBody': 'Bir model yükle, yüzeye tıkla, eşleşen UV alanını incele ve texture üzerinde yaptığın değişiklikleri 3D modelde canlı gör.',
    'dashboard.loadModel': '3D Model Yükle',
    'dashboard.recentProjects': 'Son Projeler',
    'dashboard.recentHint': 'Site verileri temizlenmediği sürece projeler bu tarayıcıda kalır.',
    'dashboard.emptyTitle': 'Henüz yerel proje yok',
    'dashboard.emptyBody': 'UV incelemeye ve texture düzenlemeye başlamak için bir model yükle.',
    'top.loadModel': 'Model Yükle',
    'top.loadTexture': 'Texture Yükle',
    'top.exportTexture': 'Texture Dışa Aktar',
    'top.exportModel': 'Model Dışa Aktar',
    'panel.tool': 'Araç',
    'panel.scene': 'Sahne',
    'panel.layers': 'Katmanlar',
    'panel.activeTool': 'Aktif Araç',
    'panel.color': 'Renk',
    'viewport.dropModel': '3D modeli buraya bırak',
  },
};

let currentLanguage = localStorage.getItem('uvmap-language') || 'en';

export function getLanguage() {
  return currentLanguage;
}

export function setLanguage(language) {
  currentLanguage = language === 'tr' ? 'tr' : 'en';
  localStorage.setItem('uvmap-language', currentLanguage);
  applyTranslations();
}

export function toggleLanguage() {
  setLanguage(currentLanguage === 'en' ? 'tr' : 'en');
  return currentLanguage;
}

export function t(key) {
  return translations[currentLanguage]?.[key] || translations.en[key] || key;
}

export function applyTranslations() {
  document.documentElement.lang = currentLanguage;
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    element.textContent = t(key);
  });
  const languageButton = document.getElementById('languageButton');
  if (languageButton) languageButton.textContent = currentLanguage === 'en' ? 'TR' : 'EN';
}
