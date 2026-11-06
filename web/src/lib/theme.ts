export const THEME_KEY = "echodev:theme";

/** Runs before paint (see layout.tsx) so the page never flashes the wrong theme. */
export const themeScript = `try{var t=localStorage.getItem("${THEME_KEY}");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d)}catch(e){}`;
