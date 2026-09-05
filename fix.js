
const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard.tsx', 'utf-8');

code = code.replace(/R?pondez a autant/g, 'Répondez à autant');
code = code.replace(/Il faut r?pondre a 10 questions/g, 'Il faut répondre à 10 questions');
code = code.replace(/cat?gorie/g, 'catégorie');
code = code.replace(/d?bloquer ce thme/g, 'débloquer ce thème');
code = code.replace(/Nouveaut? D?bloqu?e/g, 'Nouveauté Débloquée');
code = code.replace(/R?glages/g, 'Réglages');
code = code.replace(/s?rie de/g, 'série de');
code = code.replace(/d?bloqu?/g, 'débloqué');
code = code.replace(/Cosm?tique/g, 'Cosmétique');
code = code.replace(/Y'/g, '??');

fs.writeFileSync('src/app/dashboard.tsx', code);

