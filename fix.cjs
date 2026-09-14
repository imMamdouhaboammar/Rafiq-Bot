const fs = require("fs");
const path = require("path");

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith(".ts") || fullPath.endsWith(".tsx")) {
      let content = fs.readFileSync(fullPath, "utf8");
      
      let modified = false;
      const regex = /(from\s+["']\.[^"']+)["']/g;
      
      const newContent = content.replace(regex, (match, p1) => {
        // If it already has an extension, ignore
        if (p1.match(/\.[a-zA-Z0-9]+$/)) {
          return match;
        }
        modified = true;
        // Check if original quote was ' or "
        const quote = match.endsWith("'") ? "'" : '"';
        return p1 + ".js" + quote;
      });

      // Also replace dynamic imports: import("./...")
      const dynamicRegex = /(import\s*\(\s*["']\.[^"']+)["']/g;
      const newContent2 = newContent.replace(dynamicRegex, (match, p1) => {
        if (p1.match(/\.[a-zA-Z0-9]+$/)) {
          return match;
        }
        modified = true;
        const quote = match.endsWith("'") ? "'" : '"';
        return p1 + ".js" + quote;
      });
      
      if (modified) {
        fs.writeFileSync(fullPath, newContent2, "utf8");
        console.log("Updated", fullPath);
      }
    }
  }
}

processDir("./services");
processDir("./api");
processDir("./hooks");
processDir("./components");
