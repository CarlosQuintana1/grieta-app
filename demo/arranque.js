// La animacion de entrada sale una vez por sesion y nunca en modo Voz, donde solo estorbaria los toques.
try {
  const voz = JSON.parse(localStorage.getItem("grieta-acc"))?.modoVoz;
  if (voz || sessionStorage.getItem("grieta-arranco")) document.documentElement.classList.add("ya-arranco");
} catch {}
// Si los datos tardan demasiado, el inicio se enseña de todos modos.
setTimeout(() => document.documentElement.classList.add("inicio-listo"), 4000);
