function showMobileWarning(){
  const mobile=matchMedia('(max-width: 900px), (pointer: coarse)').matches;if(!mobile||sessionStorage.getItem('uvmap-mobile-warning'))return;sessionStorage.setItem('uvmap-mobile-warning','1');
  const backdrop=document.getElementById('modalBackdrop'),card=document.getElementById('modalCard');if(!backdrop||!card)return;
  card.innerHTML='<h2>Desktop recommended</h2><p>UVMap - Online is designed primarily for desktop use. Mobile editing is supported experimentally. Expect layout, performance and input issues.</p><div class="modal-actions"><button id="mobileContinue" class="primary-button" type="button">Continue anyway</button></div>';
  backdrop.classList.remove('hidden');document.getElementById('mobileContinue')?.addEventListener('click',()=>{backdrop.classList.add('hidden');card.innerHTML='';},{once:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(showMobileWarning,120));else setTimeout(showMobileWarning,120);
