FROM eclipse-temurin:17-jre-jammy
WORKDIR /app
COPY target/lexiflow-server-0.1.0-SNAPSHOT.jar /app/server.jar
ENV JAVA_TOOL_OPTIONS="-Dfile.encoding=UTF-8 -Xms128m -Xmx512m"
EXPOSE 8080
CMD ["java", "-jar", "/app/server.jar"]
