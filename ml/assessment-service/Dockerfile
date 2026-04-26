FROM ml-base:latest
WORKDIR /app
COPY . .
EXPOSE 8091
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8091"]
