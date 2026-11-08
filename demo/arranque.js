// Si la app ya arranco en esta sesion, una recarga no vuelve a mostrar la animacion de entrada.
try { if (sessionStorage.getItem("grieta-arranco")) document.documentElement.classList.add("ya-arranco"); } catch {}
