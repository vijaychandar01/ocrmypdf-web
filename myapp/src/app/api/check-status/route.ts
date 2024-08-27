import { NextResponse } from 'next/server';
import { statusStore } from '../upload/route';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const fileId: string | null = url.searchParams.get('fileId');  // Explicitly typed as string or null

  if (!fileId || !statusStore[fileId]) {
    return NextResponse.json({ status: 'not_found', progress: 0 }, { status: 404 });
  }

  const { status, outputFilePath, progress } = statusStore[fileId];
  
  // Ensure to send correct outputFilePath only if status is 'complete'
  if (status === 'complete') {
    return NextResponse.json({ status, progress: 100, outputFilePath });
  } else if (status === 'error') {
    return NextResponse.json({ status: 'error', progress: 0 });
  }

  // Send current progress if OCR is still ongoing
  const currentProgress = getProgress(statusStore[fileId].startTime);
  return NextResponse.json({ status, progress: currentProgress });
}

function getProgress(startTime: number): number {
  const elapsedTime = new Date().getTime() - startTime;
  const processingDuration = 120000; // Simulate 2 minutes for OCR processing
  return Math.min((elapsedTime / processingDuration) * 100, 99);
}
