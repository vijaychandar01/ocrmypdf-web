# Pull the base image
FROM jbarlow83/ocrmypdf

# Install all Tesseract OCR languages
RUN apt-get update && apt-get install -y \
    tesseract-ocr-all \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Set the default command (optional, you can override it with docker run)
CMD ["ocrmypdf"]