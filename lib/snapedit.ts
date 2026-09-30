const BASE_URL = "https://api.snapedit.app/v1";

export type TryOnCategory = "upperbody" | "lowerbody" | "dress";

type SnapEditTaskCreated = {
  task_id?: string;
  id?: string;
  status?: string;
  progress?: number;
  credits_used?: number;
  eta_seconds?: number;
};

export type SnapEditTaskStatus = {
  status: "queued" | "processing" | "completed" | "failed" | string;
  output_url?: string;
  progress?: number;
  error_message?: string;
};

function apiKey() {
  const key = process.env.SNAPEDIT_API_KEY;
  if (!key) {
    throw new Error("SNAPEDIT_API_KEY is not configured");
  }
  return key;
}

async function parseResponse(response: Response) {
  const raw = await response.text();
  let data: any = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { raw };
  }

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.detail ||
      data?.message ||
      data?.error ||
      raw ||
      `HTTP ${response.status}`;
    throw new Error(String(message));
  }

  return data;
}

function normalizeStatus(value: unknown): SnapEditTaskStatus["status"] {
  const status = String(value || "queued").toLowerCase();

  if (["completed", "complete", "success", "succeeded", "done"].includes(status)) {
    return "completed";
  }
  if (["failed", "failure", "error", "cancelled", "canceled"].includes(status)) {
    return "failed";
  }
  if (["processing", "running", "in_progress", "in-progress"].includes(status)) {
    return "processing";
  }
  return "queued";
}

function clothType(category: TryOnCategory) {
  if (category === "upperbody") return "upper";
  if (category === "lowerbody") return "lower";
  return "full";
}

export async function submitTryOn(input: {
  person: File;
  garment: File;
  category: TryOnCategory;
}): Promise<{ job_id: string; status: string; credits_used?: number; eta_seconds?: number }> {
  const body = new FormData();
  body.append("model_image", input.person, input.person.name || "person.jpg");
  body.append("cloth_image", input.garment, input.garment.name || "garment.jpg");
  body.append("cloth_type", clothType(input.category));
  // Keep Normal mode for the free-credit benchmark. HD consumes more credits.
  body.append("hd_mode", "false");

  const response = await fetch(`${BASE_URL}/images/try-on`, {
    method: "POST",
    headers: {
      "api-key": apiKey(),
      "User-Agent": "demo-thu-do/1.0"
    },
    body,
    cache: "no-store"
  });

  const data = (await parseResponse(response)) as SnapEditTaskCreated;
  const taskId = data.task_id || data.id;

  if (!taskId) {
    throw new Error("SnapEdit không trả task_id.");
  }

  return {
    job_id: taskId,
    status: normalizeStatus(data.status),
    credits_used: data.credits_used,
    eta_seconds: data.eta_seconds
  };
}

export async function getTryOnJob(jobId: string): Promise<SnapEditTaskStatus> {
  if (!/^[a-zA-Z0-9_-]+$/.test(jobId)) {
    throw new Error("Invalid task id");
  }

  const response = await fetch(
    `${BASE_URL}/images/try-on/tasks/${encodeURIComponent(jobId)}`,
    {
      headers: {
        "api-key": apiKey(),
        "User-Agent": "demo-thu-do/1.0"
      },
      cache: "no-store"
    }
  );

  const data = await parseResponse(response);
  const status = normalizeStatus(
    data.status ?? data.task_status ?? data.state
  );

  const outputUrl =
    data.download_url ||
    data.download_signed_url ||
    data.output_image_url ||
    data.output_url ||
    data.result_url ||
    data.result?.url ||
    data.data?.[0]?.url;

  const errorMessage =
    data.error_message ||
    data.error?.message ||
    (typeof data.error === "string" ? data.error : undefined) ||
    data.detail;

  return {
    status,
    output_url: outputUrl,
    progress: typeof data.progress === "number" ? data.progress : undefined,
    error_message: errorMessage
  };
}
