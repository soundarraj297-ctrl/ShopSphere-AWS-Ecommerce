# ShopSphere – AWS Full-Stack E-Commerce Application

## Project Overview

ShopSphere is a full-stack e-commerce web application developed using modern frontend and backend technologies and deployed on Amazon Web Services (AWS).

The application provides customer shopping functionality and administrative product and order management.

## Technology Stack

### Frontend
- React 19
- TypeScript
- Vite
- HTML5
- CSS3

### Backend
- Node.js
- Express.js
- Prisma ORM
- JWT Authentication
- bcryptjs

### Database
- Amazon RDS
- Relational Database
- Prisma ORM

### AWS Cloud Services
- Amazon S3 – Frontend static website hosting
- Amazon ECS Fargate – Backend container deployment
- Amazon ECR – Docker image repository
- Amazon RDS – Database hosting
- Application Load Balancer – Backend traffic routing
- AWS IAM – Access and permissions management

### Containerization
- Docker
- Amazon ECR

## Application Features

### Customer Features
- Customer Registration and Login
- Product Listing
- Shopping Cart
- Checkout
- Mock Payment Processing
- Order History

### Admin Features
- Admin Authentication
- Admin Dashboard
- Product Management
- Order Management

## Application Architecture

```text
              Customer
                  |
                  v
          React Frontend
                  |
                  v
             Amazon S3
          Static Website
                  |
                  v
       Application Load Balancer
                  |
                  v
           Amazon ECS
             Fargate
                  |
                  v
          Node.js / Express
                  |
                  v
              Prisma
                  |
                  v
             Amazon RDS
```

Amazon ECR is used to store backend Docker images.

## Project Deployment

The frontend is hosted using Amazon S3 Static Website Hosting.

The backend application is containerized using Docker and deployed using Amazon ECS Fargate.

The Application Load Balancer provides access to the backend API.

Amazon RDS is used for persistent database storage.

## Security Considerations

- Environment variables are excluded from Git.
- Database credentials are not included in the repository.
- AWS configuration files containing sensitive information are excluded.
- Authentication uses JWT.
- Password hashing uses bcryptjs.

## Project Status

The core ShopSphere application has been developed and deployed for learning and demonstration purposes.

Payment processing currently uses a mock payment flow.

CloudFront HTTPS distribution is not yet deployed.

## Repository Structure

```text
ShopSphere-AWS-Ecommerce/
|
|-- backend/
|   |-- prisma/
|   |-- src/
|   |-- Dockerfile
|   |-- package.json
|
|-- frontend/
|   |-- public/
|   |-- src/
|   |-- package.json
|
|-- .gitignore
|-- README.md
```

## Project Purpose

This project demonstrates practical knowledge of:

- Full-Stack Application Development
- REST API Development
- Docker Containerization
- AWS Cloud Deployment
- Database Integration
- Authentication
- Cloud Infrastructure

---

**Project:** ShopSphere – AWS E-Commerce Application

**Repository:** ShopSphere-AWS-Ecommerce
