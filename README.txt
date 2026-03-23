BacklogMS - Application Flask

1. Installation
   pip install -r requirements.txt

2. Lancement
   python app.py

3. Accès navigateur
   http://127.0.0.1:5000

4. Fonctions principales
   - Import multiple fichiers Excel
   - Fusion en un fichier BacklogMS_YYYY-MM-DD_HH-MM-SS.xlsx
   - Ajout colonnes Gouvernorat et Produit
   - Parsing des dates
   - Calcul Age Affectation et Age WF TT
   - Correction intelligente des adresses
   - Enrichissement GPS si X/Y vides
   - Export Excel stylisé avec Dashboard
   - Export PDF dashboard

5. Structure
   app.py
   templates/index.html
   static/css/style.css
   static/js/app.js
   uploads/
   outputs/

6. Remarque importante
   Le géocodage utilise Nominatim (OpenStreetMap). Si le volume de tickets est très grand,
   la correction GPS peut prendre du temps à cause de la limitation de débit.
