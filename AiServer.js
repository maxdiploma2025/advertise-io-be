import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import cors from "cors";
import sharp from "sharp";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8089;

// Enable CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

const HUGGING_FACE_API_KEY = process.env.HUGGING_FACE_API_KEY;
const HUGGING_FACE_TEXT_MODEL_URL = process.env.HUGGING_FACE_TEXT_MODEL_URL;
const HUGGING_FACE_IMAGE_MODEL_URL = process.env.HUGGING_FACE_IMAGE_MODEL_URL;

async function queryImage(prompt, parameters = {}) {
  try {
    const response = await axios.post(
      `https://api-inference.huggingface.co/models/${HUGGING_FACE_IMAGE_MODEL_URL}`,
      {
        inputs: prompt,
        parameters: parameters,
      },
      {
        headers: {
          Authorization: `Bearer ${HUGGING_FACE_API_KEY}`,
          "Content-Type": "application/json",
        },
        responseType: "arraybuffer",
        timeout: 210000,
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching response:", error);
    throw error;
  }
}


async function queryText(userMessage) {
  const systemPrompt = "You are an ai assistant for advertisement, u must answers for questions only about advertisemet";

  const prompt = `<|im_start|>system\n${systemPrompt}<|im_end|>\n` +
                 `<|im_start|>user\n${userMessage}<|im_end|>\n` +
                 `<|im_start|>assistant\n`;

  try {
    const response = await axios.post(
      `https://api-inference.huggingface.co/models/${HUGGING_FACE_TEXT_MODEL_URL}`,
      { inputs: prompt },
      {
        headers: {
          Authorization: `Bearer ${HUGGING_FACE_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const text = Array.isArray(response.data)
      ? response.data[0]?.generated_text?.replace(prompt, "") || ""
      : response.data.generated_text;

    return text;
  } catch (error) {
    console.error("Error fetching chat response:", error.response?.data || error);
    throw error;
  }
}

app.post("/image", async (req, res) => {
  const { prompt, width = 512, height = 512 } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required." });
  }

  const parameters = {
    width,
    height,
  }

  try {
    const imageData = await queryImage(prompt, parameters);

    const base64Image = Buffer.from(imageData, "binary").toString("base64");
    const dataUrl = `data:image/png;base64,${base64Image}`;

    res.json({
      message: "Image generated successfully.",
      image: dataUrl,
    });
  } catch (error) {
    res.status(500).json({ error: "Error fetching the image." });
  }
});

app.post("/chat", async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required." });
  }

  try {
    const response = await queryText(prompt);
    res.json({
      message: "Chat response received.",
      response,
    });
  } catch (error) {
    res.status(500).json({ error: "Error fetching chat response." });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
