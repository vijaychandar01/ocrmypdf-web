import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { nanoid } from 'nanoid';

const execPromise = promisify(exec);

// Status store to track file processing
export const statusStore: { [key: string]: { status: string; outputFilePath: string; startTime: number; progress: number } } = {};

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const languages = formData.get('languages') as string;

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 });
    }

    // Move uploads directory to public/uploads
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const uniqueFileName = `${nanoid()}_${file.name}`;
    const filePath = path.join(uploadDir, uniqueFileName);
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, fileBuffer);

    const outputFileName = uniqueFileName.replace(/\.[^/.]+$/, '') + '_output.pdf';
    const outputFilePath = path.join(uploadDir, outputFileName);
    statusStore[uniqueFileName] = { status: 'processing', outputFilePath: '', startTime: Date.now(), progress: 0 };

    (async () => {
      const command = `docker run --rm -v "${uploadDir}:/data" samyaktechlabsocr:latest "/data/${uniqueFileName}" "/data/${outputFileName}" -l ${languages} --jobs 4 --optimize 0 --skip-text --skip-big 10`;
      console.log('Executing OCR Command:', command);
      try {
        const { stdout, stderr } = await execPromise(command);
        console.log('OCR Output:', stdout);
        if (stderr) {
          console.error('OCR Error:', stderr);
        }
        if (fs.existsSync(outputFilePath)) {
          // Update the statusStore immediately after the file is found
          statusStore[uniqueFileName] = {
            status: 'complete',
            outputFilePath: `/uploads/${outputFileName}`, // Updated path for public access
            startTime: statusStore[uniqueFileName].startTime,
            progress: 100,
          };
        } else {
          throw new Error('OCR processing failed. Output file not found.');
        }
      } catch (err) {
        console.error('Error executing OCR:', err);
        statusStore[uniqueFileName].status = 'error';
        statusStore[uniqueFileName].progress = 0;
      }
    })();

    return NextResponse.json({
      message: 'File uploaded successfully. Processing OCR...',
      fileId: uniqueFileName,
    });
  } catch (error) {
    let errorMessage = 'Unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    console.error('Error during file upload:', errorMessage);
    return NextResponse.json({ error: `Error processing file: ${errorMessage}` }, { status: 500 });
  }
}
