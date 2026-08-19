function ensureMaterialSymbols(){
  const id='uvmap-material-symbols-font';
  let link=document.getElementById(id);
  if(!link){
    link=document.createElement('link');
    link.id=id;
    link.rel='stylesheet';
    link.href='https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..24,300..500,0..1,0&display=block';
    document.head.append(link);
  }

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
  const icons={
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
  document.querySelectorAll('.tool-button[data-tool]').forEach(button=>{
    let icon=button.querySelector('.material-symbols-outlined');
    if(!icon){
      icon=button.querySelector('span');
      if(icon)icon.classList.add('material-symbols-outlined');
    }
    if(icon&&icons[button.dataset.tool])icon.textContent=icons[button.dataset.tool];
  });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(applyGoogleToolIcons,20));
else setTimeout(applyGoogleToolIcons,20);
