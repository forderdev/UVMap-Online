const TOOL_ICONS={
  select:'ads_click',
  brush:'brush',
  eraser:'ink_eraser',
  paint3d:'format_paint',
  eyedropper:'colorize',
  fill:'format_color_fill',
  line:'horizontal_rule',
  rect:'crop_square',
  ellipse:'circle',
  lasso:'gesture',
  move:'control_camera'
};

const UI_ICONS=[
  'add','arrow_back','center_focus_strong','close','compare','content_copy',
  'database','delete','deployed_code','deployed_code_update','download','fit_screen',
  'fullscreen','history','image','image_not_supported','layers','mouse','open_in_full',
  'palette','pause','play_arrow','redo','settings','stop','sync','texture','tune',
  'undo','upload_file','view_in_ar','menu',
  ...Object.values(TOOL_ICONS)
];

function ensureMaterialSymbols(){
  const names=[...new Set(UI_ICONS)].sort().join(',');
  const href=`https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined&icon_names=${names}&display=block`;
  let link=document.getElementById('uvmap-material-symbols-font');
  if(!link){
    link=document.createElement('link');
    link.id='uvmap-material-symbols-font';
    link.rel='stylesheet';
    document.head.append(link);
  }
  link.href=href;

  if(!document.getElementById('uvmap-material-symbols-style')){
    const style=document.createElement('style');
    style.id='uvmap-material-symbols-style';
    style.textContent=`
      .material-symbols-outlined {
        font-family: 'Material Symbols Outlined' !important;
        font-weight: normal;
        font-style: normal;
        line-height: 1;
        letter-spacing: normal;
        text-transform: none !important;
        display: inline-block;
        white-space: nowrap;
        word-wrap: normal;
        direction: ltr;
        font-feature-settings: 'liga';
        -webkit-font-feature-settings: 'liga';
        -webkit-font-smoothing: antialiased;
      }
    `;
    document.head.append(style);
  }
}

function applyGoogleToolIcons(){
  ensureMaterialSymbols();
  document.querySelectorAll('.tool-button[data-tool]').forEach(button=>{
    let icon=button.querySelector('.material-symbols-outlined');
    if(!icon){
      icon=button.querySelector('span');
      if(icon)icon.classList.add('material-symbols-outlined');
    }
    if(icon&&TOOL_ICONS[button.dataset.tool])icon.textContent=TOOL_ICONS[button.dataset.tool];
  });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(applyGoogleToolIcons,20));
else setTimeout(applyGoogleToolIcons,20);
