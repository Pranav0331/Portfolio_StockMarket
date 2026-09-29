package com.portfolio;

import com.portfolio.config.DotenvEnvironmentPostProcessor;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class BackendApplication {

	public static void main(String[] args) {
		DotenvEnvironmentPostProcessor.loadDotenvDirectly();
		SpringApplication.run(BackendApplication.class, args);
	}

}

