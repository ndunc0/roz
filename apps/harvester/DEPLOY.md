# Deploying Harvester to Google Cloud Run

This guide covers deploying the Mastra harvester application to Google Cloud Run.

## Prerequisites

1. **Google Cloud CLI** installed and authenticated:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

2. **Enable required APIs**:
   ```bash
   gcloud services enable cloudbuild.googleapis.com
   gcloud services enable run.googleapis.com
   gcloud services enable artifactregistry.googleapis.com
   ```

3. **Environment variables** - Prepare these values:
   - `OPENAI_API_KEY` (or other LLM provider keys)
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `BRIGHTDATA_API_KEY`
   - `BROWSERBASE_API_KEY`
   - Any other API keys used by your agents/tools

## Deployment Methods

### Method 1: Deploy from Source (Recommended)

Deploy directly from the repository root:

```bash
gcloud run deploy harvester \
  --source . \
  --dockerfile apps/harvester/Dockerfile \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --max-instances 10 \
  --min-instances 0 \
  --set-env-vars "NODE_ENV=production" \
  --update-secrets "OPENAI_API_KEY=openai-api-key:latest,SUPABASE_URL=supabase-url:latest,SUPABASE_ANON_KEY=supabase-anon-key:latest,SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest,BRIGHTDATA_API_KEY=brightdata-api-key:latest,BROWSERBASE_API_KEY=browserbase-api-key:latest"
```

**Note**: This assumes you've stored secrets in Google Secret Manager. See "Managing Secrets" below.

### Method 2: Build and Push to Artifact Registry

1. **Create an Artifact Registry repository**:
   ```bash
   gcloud artifacts repositories create harvester \
     --repository-format=docker \
     --location=us-central1 \
     --description="Harvester Mastra app"
   ```

2. **Build and push the image** (from repo root):
   ```bash
   # Configure Docker to use gcloud as credential helper
   gcloud auth configure-docker us-central1-docker.pkg.dev

   # Build and tag
   docker build -f apps/harvester/Dockerfile -t us-central1-docker.pkg.dev/YOUR_PROJECT_ID/harvester/app:latest .

   # Push to registry
   docker push us-central1-docker.pkg.dev/YOUR_PROJECT_ID/harvester/app:latest
   ```

3. **Deploy from Artifact Registry**:
   ```bash
   gcloud run deploy harvester \
     --image us-central1-docker.pkg.dev/YOUR_PROJECT_ID/harvester/app:latest \
     --region us-central1 \
     --platform managed \
     --allow-unauthenticated \
     --memory 2Gi \
     --cpu 2 \
     --timeout 3600 \
     --max-instances 10 \
     --min-instances 0 \
     --update-secrets "OPENAI_API_KEY=openai-api-key:latest,SUPABASE_URL=supabase-url:latest,SUPABASE_ANON_KEY=supabase-anon-key:latest,SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest,BRIGHTDATA_API_KEY=brightdata-api-key:latest,BROWSERBASE_API_KEY=browserbase-api-key:latest"
   ```

## Managing Secrets

Store sensitive credentials in Google Secret Manager:

```bash
# Create secrets (do this once)
echo -n "your-openai-key" | gcloud secrets create openai-api-key --data-file=-
echo -n "your-supabase-url" | gcloud secrets create supabase-url --data-file=-
echo -n "your-supabase-anon-key" | gcloud secrets create supabase-anon-key --data-file=-
echo -n "your-supabase-service-role-key" | gcloud secrets create supabase-service-role-key --data-file=-
echo -n "your-brightdata-key" | gcloud secrets create brightdata-api-key --data-file=-
echo -n "your-browserbase-key" | gcloud secrets create browserbase-api-key --data-file=-

# Grant Cloud Run access to secrets
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)")
gcloud secrets add-iam-policy-binding openai-api-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Repeat for all secrets
gcloud secrets add-iam-policy-binding supabase-url --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding supabase-anon-key --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding supabase-service-role-key --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding brightdata-api-key --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding browserbase-api-key --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
```

## Configuration Notes

### Memory and CPU
- **Memory**: 2Gi recommended (digest workflow runs browser automation + LLM calls)
- **CPU**: 2 vCPUs recommended for parallel processing
- Adjust based on usage patterns and costs

### Timeout
- **3600 seconds (1 hour)** matches the Mastra server timeout in `apps/harvester/src/mastra/index.ts`
- The digest workflow can take significant time for blog scraping and LLM processing
- Cloud Run maximum is 3600 seconds

### Concurrency
- Default concurrency is 80 requests per instance
- Consider lowering if workflows are resource-intensive:
  ```bash
  --concurrency 10
  ```

### Autoscaling
- **min-instances 0**: Scales to zero when idle (cost-effective)
- **max-instances 10**: Prevents runaway costs
- Consider **min-instances 1** if cold start latency is a concern

## Testing the Deployment

Once deployed, test the endpoint:

```bash
# Get the service URL
SERVICE_URL=$(gcloud run services describe harvester --region us-central1 --format='value(status.url)')

# Test the harvester workflow
curl -X POST "${SERVICE_URL}/workflows/harvester/run" \
  -H "Content-Type: application/json" \
  -d '{
    "companyId": "factory-ai",
    "companyName": "Factory AI",
    "blogUrl": "https://www.factory.ai/blog",
    "linkedInUrl": "https://www.linkedin.com/company/factory-ai/posts/"
  }'
```

## Continuous Deployment

Set up automatic deployments on git push:

```bash
gcloud builds submit --config cloudbuild.yaml
```

Create `cloudbuild.yaml` in the repo root:

```yaml
steps:
  # Build the container image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-f', 'apps/harvester/Dockerfile', '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/harvester/app:$COMMIT_SHA', '.']

  # Push to Artifact Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'us-central1-docker.pkg.dev/$PROJECT_ID/harvester/app:$COMMIT_SHA']

  # Deploy to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'harvester'
      - '--image'
      - 'us-central1-docker.pkg.dev/$PROJECT_ID/harvester/app:$COMMIT_SHA'
      - '--region'
      - 'us-central1'
      - '--platform'
      - 'managed'

images:
  - 'us-central1-docker.pkg.dev/$PROJECT_ID/harvester/app:$COMMIT_SHA'
```

## Monitoring

View logs:
```bash
gcloud run services logs read harvester --region us-central1 --limit 50
```

Monitor metrics in Cloud Console:
- Request count
- Request latency
- Container instance count
- Memory and CPU utilization

## Troubleshooting

### Build Failures
- Check Docker build locally: `docker build -f apps/harvester/Dockerfile .`
- Ensure all workspace packages build successfully

### Runtime Errors
- Check Cloud Run logs for startup errors
- Verify all secrets are properly configured
- Ensure sufficient memory/CPU allocation

### Timeout Issues
- Increase `--timeout` if workflows exceed 3600s
- Consider breaking long workflows into smaller chunks
- Use Cloud Tasks or Cloud Scheduler for async processing

## Cost Optimization

1. **Scale to zero**: Use `--min-instances 0` when traffic is intermittent
2. **Right-size resources**: Start with 1Gi/1vCPU and adjust based on metrics
3. **Use secrets**: Avoid rebuilding for config changes
4. **Regional deployment**: Deploy in regions close to your users/data
5. **Request batching**: Process multiple companies in one workflow invocation if possible
