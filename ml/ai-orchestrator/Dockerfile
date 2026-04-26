FROM ml-base:latest
WORKDIR /app
COPY . .
RUN mkdir -p /app/data/storage
EXPOSE 8092
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8092"]
