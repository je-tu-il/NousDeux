const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard.tsx', 'utf8');

// Use a regex that allows any whitespace
code = code.replace(
  /<\/ImageBackground>\s*\);\s*}\s*const styles = StyleSheet\.create\(\{/,
  `        </ScrollView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({`
);

fs.writeFileSync('src/app/dashboard.tsx', code);
console.log("Fixed end tags with regex!");
