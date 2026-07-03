export interface OcrResult {
  content: string;
  confidence: number;
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

  const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
  const body = {
    requests: [
      {
        image: { content: imageBase64 },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
      },
    ],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('OCR API error:', errText);
    throw new Error(`OCR API error: ${res.status}`);
  }

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
