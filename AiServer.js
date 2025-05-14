import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import cors from "cors";
import sharp from "sharp";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8089;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

const HUGGING_FACE_API_KEY = process.env.HUGGING_FACE_API_KEY;
const HUGGING_FACE_TEXT_MODEL_URL = process.env.HUGGING_FACE_TEXT_MODEL_URL;
const HUGGING_FACE_IMAGE_MODEL_URL = process.env.HUGGING_FACE_IMAGE_MODEL_URL;

async function queryImage(data, retryCount = 0) {
  const MAX_RETRIES = 3;

  const response = await fetch(
    `https://router.huggingface.co/hf-inference/models/${HUGGING_FACE_IMAGE_MODEL_URL}`,
    {
      headers: {
        Authorization: `Bearer ${HUGGING_FACE_API_KEY}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify(data),
    }
  );

  const contentType = response.headers.get("content-type") || "";
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const dataUrl = `data:${contentType};base64,${base64}`;

  if (contentType.startsWith("text/html")) {
    console.warn(`Received HTML response. Retry attempt ${retryCount + 1}`);

    if (retryCount < MAX_RETRIES) {
      return queryImage(data, retryCount + 1);
    } else {
      throw new Error("Failed to generate image after multiple retries.");
    }
  }

  return dataUrl;
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
  const { prompt, width, height } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required." });
  }
  try {
    const imageDataUrl = await queryImage({inputs: prompt, parameters: {width, height}});

    res.json({
      message: "Image generated successfully.",
      image: imageDataUrl,
    });
  } catch (error) {
    res.status(500).json({ error: "Error generating image." });
    console.log(error);
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
