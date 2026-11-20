"""Capture d'écran d'une page d'essai (pas dans le jeu), pour vérifier un modèle 3D sans ouvrir de navigateur.

Usage (le serveur de développement doit tourner, port 5177 par défaut) :
    python essai/capture.py "personnage.html?gros=1" sortie.png [largeur] [hauteur]
Le chemin est relatif à http://localhost:5177/essai/ ; une adresse complète (http://...) est aussi acceptée.
Le texte de mesure de la page (maillages, triangles) est affiché dans la console.
"""
import sys

from playwright.sync_api import sync_playwright


def main() -> None:
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    page_essai, sortie = sys.argv[1], sys.argv[2]
    largeur = int(sys.argv[3]) if len(sys.argv) > 3 else 1000
    hauteur = int(sys.argv[4]) if len(sys.argv) > 4 else 700
    adresse = page_essai if page_essai.startswith("http") else f"http://localhost:5177/essai/{page_essai}"
    with sync_playwright() as p:
        navigateur = p.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        page = navigateur.new_page(viewport={"width": largeur, "height": hauteur})
        erreurs: list[str] = []
        page.on("pageerror", lambda e: erreurs.append(str(e)))
        page.on("console", lambda m: erreurs.append(m.text) if m.type == "error" else None)
        page.goto(adresse)
        try:
            page.wait_for_selector("#mesure", timeout=20000)
            print(page.inner_text("#mesure"))
        except Exception:
            print("(pas de texte de mesure : la page a peut-être planté)")
        page.screenshot(path=sortie)
        for e in erreurs:
            print("ERREUR :", e)
        navigateur.close()


if __name__ == "__main__":
    main()
