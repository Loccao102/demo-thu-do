const BASE_URL = "https://api.pixelapi.dev";

export type TryOnCategory = "upperbody" | "lowerbody" | "dress";

type SubmitResponse = {
  job_id: string;
  status?: string;
  credits_used?: number;
  eta_seconds?: number;
};

export type JobResponse = {
  status: "queued" | "processing" | "completed" | "failed" | string;
  result_image_b64?: string;
  output_url?: string;
  inference_time_ms?: number;
  error_message?: string;
  detail?: string;
};

function apiKey() {
  const key = process.env.PIXELAPI_KEY;
  if (!key) {
    throw new Error("PIXELAPI_KEY is not configured");
  }
  return key;
}

async function parseError(response: Response) {
  const raw = await response.text();
  try {
    const json = JSON.parse(raw);
    return json.detail || json.error || json.message || raw;
  } catch {
    return raw || ("HTTP " + response.status);
  }
}

export async function submitTryOn(input: {
  personImageBase64: string;
  garmentImageBase64: string;
  category: TryOnCategory;
}): Promise<SubmitResponse> {
  const response = await fetch(BASE_URL + "/v1/virtual-tryon", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey(),
      "Content-Type": "application/json",
      "User-Agent": "demo-thu-do/1.0"
    },
    body: JSON.stringify({
      person_image: input.personImageBase64,
      garment_image: input.garmentImageBase64,
      category: input.category,
      n_samples: 1,
      n_steps: 40,
      image_scale: 2.5
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json();
}

export async function getTryOnJob(jobId: string): Promise<JobResponse> {
  if (!/^[a-zA-Z0-9_-]+$/.test(jobId)) {
    throw new Error("Invalid job id");
  }

  const response = await fetch(
    BASE_URL + "/v1/virtual-tryon/jobs/" + encodeURIComponent(jobId),
    {
      headers: {
        Authorization: "Bearer " + apiKey(),
        "User-Agent": "demo-thu-do/1.0"
      },
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json();
}
