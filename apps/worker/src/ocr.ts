export interface OcrResult {
  content: string;
  confidence: number;
}

const OCR_TIMEOUT_MS = 30_000;
const OCR_MAX_RETRIES = 3;
const OCR_BASE_DELAY_MS = 1_000;

async function fetchOcrWithRetry(url: string, body: unknown, apiKey: string): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= OCR_MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (res.ok) return res;

      const errText = await res.text();
      console.error(`[OCR] attempt ${attempt}/${OCR_MAX_RETRIES} failed: ${res.status}`, errText);

      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        throw new Error(`OCR API error: ${res.status}`);
      }
      lastError = new Error(`OCR API error: ${res.status}`);
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('OCR API error:')) {
        throw err;
      }
      if (err instanceof DOMException && err.name === 'AbortError') {
        console.warn(
          `[OCR] attempt ${attempt}/${OCR_MAX_RETRIES} timed out after ${OCR_TIMEOUT_MS}ms`,
        );
        lastError = new Error('OCR 请求超时');
      } else {
        console.error(`[OCR] attempt ${attempt}/${OCR_MAX_RETRIES} network error:`, err);
        lastError = err instanceof Error ? err : new Error('网络错误');
      }
    } finally {
      clearTimeout(timeoutId);
    }

    if (attempt < OCR_MAX_RETRIES) {
      const delay = OCR_BASE_DELAY_MS * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new Error('OCR 请求失败');
}

export async function performOcr(imageBase64: string): Promise<OcrResult> {
  const apiKey = process.env.OCR_API_KEY;

  if (!apiKey) {
    console.warn('OCR_API_KEY not configured, returning mock result');
    return {
      content:
        'This is a mock OCR result. Please configure OCR_API_KEY to enable real handwriting recognition.',
      confidence: 0.85,
    };
  }

  const url = 'https://vision.googleapis.com/v1/images:annotate';
  const body = {
    requests: [
      {
        image: { content: imageBase64 },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
      },
    ],
  };

  const res = await fetchOcrWithRetry(url, body, apiKey);

  const data = (await res.json()) as {
    responses?: Array<{
      fullTextAnnotation?: { text?: string; confidence?: number };
      error?: { message?: string };
    }>;
  };
  const response = data.responses?.[0];

  if (response?.error) {
    throw new Error(`OCR error: ${response.error.message ?? 'unknown'}`);
  }

  const annotation = response?.fullTextAnnotation;
  if (!annotation) {
    return { content: '', confidence: 0 };
  }

  return {
    content: annotation.text ?? '',
    confidence: annotation.confidence ?? 0.9,
  };
}
