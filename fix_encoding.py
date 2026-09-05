# -*- coding: utf-8 -*-
import os

replacements = {
    'RÃ©pondez Ã': 'Répondez à',
    'rÃ©pondre Ã': 'répondre à',
    'catÃ©gorie': 'catégorie',
    'dÃ©bloquer': 'débloquer',
    'NouveautÃ© DÃ©bloquÃ©e': 'Nouveauté Débloquée',
    'sÃ©rie de': 'série de',
    'RÃ©glages': 'Réglages',
    'dÃ©bloquÃ©': 'débloqué',
    'CosmÃ©tique': 'Cosmétique',
    'ddbloquer': 'débloquer',
    'thme': 'thème'
}

for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            original = content
            for k, v in replacements.items():
                content = content.replace(k, v)
                
            if content != original:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(content)
                print('Fixed', path)

