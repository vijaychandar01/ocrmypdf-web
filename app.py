from flask import Flask, render_template, request, redirect, url_for, send_from_directory, jsonify
import os
import subprocess
import werkzeug
import zipfile
import uuid
import time
from PyPDF2 import PdfReader

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads/'
app.config['PROGRESS_FOLDER'] = 'progress/'
app.config['ALLOWED_EXTENSIONS'] = {'pdf'}

if not os.path.exists(app.config['UPLOAD_FOLDER']):
    os.makedirs(app.config['UPLOAD_FOLDER'])

if not os.path.exists(app.config['PROGRESS_FOLDER']):
    os.makedirs(app.config['PROGRESS_FOLDER'])

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

def count_pages(pdf_path):
    try:
        reader = PdfReader(pdf_path)
        return len(reader.pages)
    except Exception as e:
        print(f"Error counting pages in {pdf_path}: {e}")
        return 0

def update_progress(filename, progress):
    progress_file = os.path.join(app.config['PROGRESS_FOLDER'], f'{filename}.txt')
    with open(progress_file, 'w') as f:
            f.write(str(progress))

def get_progress(filename):
    progress_file = os.path.join(app.config['PROGRESS_FOLDER'], f'{filename}.txt')
    if os.path.exists(progress_file):
        with open(progress_file, 'r') as f:
            return f.read().strip()
    return '0'

@app.route('/', methods=['GET', 'POST'])
def index():
    if request.method == 'POST':
        files = request.files.getlist('file')
        selected_languages = request.form.getlist('languages')

        if not selected_languages:
            selected_languages = ["eng"]

        language_flag = '+'.join(selected_languages[:3])
        output_files = []
        task_id = uuid.uuid4().hex

        # Initialize progress to 0
        update_progress(task_id, 0)
        total_files = len(files)
        total_pages = 0
        pages_processed = 0
        
        # Calculate the total number of pages across all files
        file_page_counts = {}

        for file in files:
            if file and allowed_file(file.filename):
                filename = werkzeug.utils.secure_filename(file.filename)
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(file_path)
                page_count = count_pages(file_path)
                file_page_counts[filename] = page_count
                total_pages += page_count

        for file in files:
            if file and allowed_file(file.filename):
                filename = werkzeug.utils.secure_filename(file.filename)
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)

                output_file = filename.rsplit('.', 1)[0] + '-ocr.pdf'
                output_file_path = os.path.join(app.config['UPLOAD_FOLDER'], output_file)

                command = [
                    'docker', 'run', '--rm', '-i', '-v',
                    f"{os.path.abspath(app.config['UPLOAD_FOLDER'])}:/data",
                    'samyaktechlabsocr:v1',
                    f'/data/{filename}', f'/data/{output_file}',
                    '-l', language_flag, '--jobs', '4', '--optimize', '0',
                    '--skip-text', '--skip-big', '10'
                ]

                subprocess.run(command, check=True)
                output_files.append(output_file)

                # Update pages processed and calculate new progress
                pages_processed += file_page_counts[filename]
                progress = int((pages_processed / total_pages) * 100)
                update_progress(task_id, progress)

        if len(output_files) > 1:
            zip_filename = f'ocr_results_{task_id}.zip'
            zip_filepath = os.path.join(app.config['UPLOAD_FOLDER'], zip_filename)
            with zipfile.ZipFile(zip_filepath, 'w') as zf:
                for output_file in output_files:
                    zf.write(os.path.join(app.config['UPLOAD_FOLDER'], output_file), output_file)
            result_file = zip_filename
        else:
            result_file = output_files[0]

        update_progress(task_id, 100)
        return jsonify({'task_id': task_id, 'result_file': result_file})

    languages = ["eng", "hin", "guj"]
    return render_template('index.html', languages=languages)

@app.route('/progress/<task_id>')
def progress(task_id):
    progress = get_progress(task_id)
    return jsonify({'progress': progress})

@app.route('/download_page/<task_id>')
def download_page(task_id):
    result_file = request.args.get('result_file')
    return render_template('download.html', filename=result_file, task_id=task_id)

@app.route('/download_file/<filename>')
def download_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename, as_attachment=True)

if __name__ == '__main__':
    app.run(debug=True)
