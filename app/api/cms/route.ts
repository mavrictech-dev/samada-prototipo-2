import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { seedState } from "@/lib/seed";
import type { CmsState } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE_PATH = path.join(DATA_DIR, "cms-state.json");

function ensureFile(): CmsState {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(FILE_PATH)) {
      fs.writeFileSync(FILE_PATH, JSON.stringify(seedState, null, 2), "utf8");
      return seedState;
    }
    const raw = fs.readFileSync(FILE_PATH, "utf8");
    return JSON.parse(raw) as CmsState;
  } catch (error) {
    console.error("Error reading cms-state.json, falling back to seed:", error);
    return seedState;
  }
}

export async function GET() {
  const state = ensureFile();
  return NextResponse.json(state, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const updatedState: CmsState = {
      ...body,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(FILE_PATH, JSON.stringify(updatedState, null, 2), "utf8");
    return NextResponse.json({ ok: true, updatedAt: updatedState.updatedAt });
  } catch (error) {
    console.error("Error saving cms-state.json:", error);
    return NextResponse.json({ ok: false, error: "Failed to save CMS state" }, { status: 500 });
  }
}
