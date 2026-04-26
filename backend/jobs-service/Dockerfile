# Stage 1: Build
FROM eclipse-temurin:17-jdk AS build

WORKDIR /app

COPY pom.xml .
COPY src ./src

RUN apt-get update && apt-get install -y maven && \
    mvn clean package -DskipTests && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Stage 2: Runtime
FROM eclipse-temurin:17-jre

WORKDIR /app

RUN mkdir -p /app/data/storage

COPY --from=build /app/target/*.jar app.jar

EXPOSE 8083

ENV JAVA_OPTS=""

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
