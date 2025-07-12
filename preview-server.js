import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { nanoid } from 'nanoid';
import { fileURLToPath } from 'url';

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PREVIEWS_DIR = path.join(__dirname, 'previews');
await fs.mkdir(PREVIEWS_DIR, { recursive: true });

function runBuild(projectDir) {
  return new Promise((resolve, reject) => {
    exec('corepack enable && pnpm install && pnpm run build', { cwd: projectDir }, (err, stdout, stderr) => {
      if (err) return reject(stderr);
      resolve(stdout);
    });
  });
}

app.get('/', (req, res) => {
  res.send('Servidor de preview (React/Vite) rodando!');
});

app.use('/preview', express.static(PREVIEWS_DIR));

app.post('/build', async (req, res) => {
  console.log('📩 Requisição recebida em /build');

  const { files } = req.body;
  if (!files || typeof files !== 'object') {
    return res.status(400).json({ error: 'Payload inválido: "files" ausente ou malformado.' });
  }

  const id = nanoid();
  const projectDir = path.join(PREVIEWS_DIR, id);
  const srcDir = path.join(projectDir, 'src');
  const publicDir = path.join(projectDir, 'public');

  await fs.mkdir(srcDir, { recursive: true });
  await fs.mkdir(publicDir, { recursive: true });

  try {
    await Promise.all(
      Object.entries(files).map(async ([filePath, content]) => {
        const fileContent = typeof content === 'string'
          ? content
          : JSON.stringify(content, null, 2);
        const fullPath = path.join(projectDir, filePath);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, fileContent);
      })
    );

    await runBuild(projectDir);
    const previewUrl = `https://${req.headers.host}/preview/${id}/dist/`;
    res.json({ url: previewUrl });
  } catch (e) {
    console.error('Erro ao gerar preview:', e);
    res.status(500).json({ error: 'Erro no build', log: e.toString() });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
