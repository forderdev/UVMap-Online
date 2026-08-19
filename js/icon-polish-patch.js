function applyGoogleToolIcons(){
  const icons={select:'ads_click',brush:'brush',eraser:'ink_eraser',paint3d:'format_paint',eyedropper:'colorize',fill:'format_color_fill',line:'horizontal_rule',rect:'crop_square',ellipse:'circle',lasso:'gesture',move:'control_camera'};
  document.querySelectorAll('.tool-button[data-tool]').forEach(button=>{const icon=button.querySelector('.material-symbols-outlined');if(icon&&icons[button.dataset.tool])icon.textContent=icons[button.dataset.tool];});
  const names=[...new Set([...Object.values(icons),'menu'])].sort().join(',');
  const href=`https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined&icon_names=${names}&display=block`;
  const current=[...document.querySelectorAll('link[rel="stylesheet"]')].find(link=>link.href.includes('Material+Symbols+Outlined'));
  if(current)current.href=href;else{const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.append(link);}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(applyGoogleToolIcons,20));else setTimeout(applyGoogleToolIcons,20);
