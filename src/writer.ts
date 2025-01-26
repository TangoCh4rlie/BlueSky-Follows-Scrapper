import * as fs from 'fs';
import * as path from 'path';

export function writeNodesToCSV(array: string[], filename: string) {
    const content = ['Id', ...array.map((item) => `${item}`)].join('\n');

    writer(filename, content);
}

export function writeEdgesToCSV(array: [string, string][], filename: string) {
    const content = ['Source,Target', ...array.map(row => row.join(','))].join('\n'); 

    writer(filename, content);
}

function writer(filename: string, content: string) {
    const dirPath = path.join("./data");
    const filePath = path.join(dirPath, filename);

    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`${filename} écrit avec succès.`);
}