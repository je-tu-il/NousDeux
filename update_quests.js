
const fs = require('fs');

function updateDaylink() {
  const path = 'src/components/Daylink.tsx';
  if (!fs.existsSync(path)) return;
  let code = fs.readFileSync(path, 'utf-8');
  if (!code.includes('checkQuests')) {
    code = code.replace(/import \{([^}]+)\} from '\.\.\/lib\/economy'/, 'import { , checkQuests } from \'../lib/economy\'');
    
    code = code.replace(
      /await setDoc\(\s*doc\(db, 'couples', cId, 'daily', slotKey, 'answers', myUid\),\s*\{[^}]+\}\s*\);/,
      $&
      checkQuests(cId, 'question_answered', 1).catch(e => console.error(e));
    );
    
    code = code.replace(
      /if \(pAns\.exists\(\)\) \{/,
      if (pAns.exists()) {
          checkQuests(cId, 'both_active', 1).catch(e => console.error(e));
    );
    
    fs.writeFileSync(path, code);
  }
}

function updateUnlimited() {
  const path = 'src/components/UnlimitedQuestions.tsx';
  if (!fs.existsSync(path)) return;
  let code = fs.readFileSync(path, 'utf-8');
  if (!code.includes('checkQuests')) {
    code = code.replace(/import \{([^}]+)\} from '\.\.\/lib\/economy'/, 'import { , checkQuests } from \'../lib/economy\'');
    
    code = code.replace(
      /await setDoc\(doc\(db, 'couples', cId, 'daily', slotKey, 'answers', myUid\)[^;]+;/,
      $&
        checkQuests(cId, 'bonus_question', 1).catch(e => console.error(e));
        checkQuests(cId, 'question_answered', 1).catch(e => console.error(e));
    );
    
    fs.writeFileSync(path, code);
  }
}

updateDaylink();
updateUnlimited();

