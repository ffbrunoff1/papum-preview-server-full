import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { nanoid } from 'nanoid';
import { fileURLToPath } from 'url';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PREVIEWS_DIR = path.join(__dirname, 'previews');

await fs.mkdir(PREVIEWS_DIR, { recursive: true });

const runCommand = (cmd, args, projectDir) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: projectDir, shell: true });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => (stdout += data.toString()));
    child.stderr.on('data', (data) => (stderr += data.toString()));

    child.on('close', (code) => {
      if (code !== 0) {
        reject(stderr);
      } else {
        resolve(stdout);
      }
    });
  });

async function runBuild(projectDir) {
  await runCommand('corepack', ['enable'], projectDir);
  await runCommand('pnpm', ['install'], projectDir);
  await runCommand('pnpm', ['run', 'build'], projectDir);
}

app.get('/', (req, res) => {
  res.send('🚀 Servidor de preview React/Vite funcionando corretamente.');
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

  try {
    await Promise.all(
      Object.entries(files).map(async ([filePath, content]) => {
        const fileContent =
          typeof content === 'string' ? content : JSON.stringify(content, null, 2);
        const fullPath = path.join(projectDir, filePath);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, fileContent);
      })
    );

    await runBuild(projectDir);

    const previewUrl = `https://${req.headers.host}/preview/${id}/dist/`;
    console.log('✅ Preview criado com sucesso:', previewUrl);
    res.json({ url: previewUrl });
  } catch (error) {
    console.error('❌ Erro ao gerar preview:', error);
    res.status(500).json({ error: 'Erro no build', log: error.toString() });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
