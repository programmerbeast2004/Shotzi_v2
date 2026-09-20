# Shotzi

> A modern photo-sharing and photo-dump platform built for people who
> want a simple, visual, and personal way to share moments.

Shotzi is a full-stack social photo platform focused on effortless photo
sharing, personal profiles, discovery, and a clean visual experience.
The project combines a modern Next.js frontend with Supabase-powered
backend services to keep the experience fast, responsive, and easy to
scale.

## Preview

**Live Demo:** Coming soon

**Developer:** [Apoorv Mehrotra](https://www.its-apoorv.me/)

------------------------------------------------------------------------

## Why Shotzi?

Most social platforms are designed around engagement metrics,
algorithms, and endless feeds.

Shotzi takes a simpler approach.

It is built around the idea of **photo dumps**: share the moments you
want, keep them organized on your profile, and let the visuals speak for
themselves.

The goal is to make posting feel lightweight while still providing the
core functionality expected from a modern social platform.

------------------------------------------------------------------------

## Features

### Photo Sharing

-   Upload and publish photo posts
-   Support for image-based photo dumps
-   Caption and post metadata
-   Clean, responsive post layouts

### Profiles

-   Personal profile pages
-   Profile information and customization
-   User post grid
-   Profile-based content discovery

### Social Features

-   Comments
-   Interactive post experience
-   User-focused content discovery
-   Reels / short-form visual content support

### Admin Controls

-   Administrative controls for managing platform content
-   Backend-powered management functionality
-   Supabase-based data operations

### Modern UI

-   Responsive design
-   Mobile-friendly layouts
-   Smooth interactions
-   Visual-first interface
-   Dark/light interface support where configured

------------------------------------------------------------------------

## Tech Stack

  Layer                Technology
  -------------------- ------------------
  Framework            Next.js
  Language             JavaScript
  Styling              Tailwind CSS
  Backend / Database   Supabase
  Database             PostgreSQL
  Authentication       Supabase Auth
  Storage              Supabase Storage
  Deployment           Vercel
  Package Manager      npm

------------------------------------------------------------------------

## Project Structure

``` text
Shotzi/
├── app/
│   ├── ...                 # Next.js application routes and pages
│   └── ...
├── components/
│   ├── ...                 # Reusable UI components
│   └── ...
├── data/
│   └── ...                 # Application data and configuration
├── lib/
│   └── ...                 # Supabase and utility functions
├── public/
│   └── ...                 # Static assets
├── supabase-chat-rooms.sql # Supabase database SQL
├── next.config.mjs
├── tailwind.config.mjs
├── postcss.config.mjs
├── jsconfig.json
├── package.json
└── .env.example
```

------------------------------------------------------------------------

## Getting Started

### 1. Clone the repository

``` bash
git clone https://github.com/programmerbeast2004/Shotzi_v2.git
cd Shotzi_v2
```

### 2. Install dependencies

``` bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the project root.

``` env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

If your local `.env.example` contains additional variables, configure
those as required by the corresponding features.

### 4. Configure Supabase

Create a Supabase project and add your project credentials to
`.env.local`.

If the project requires database tables or policies from the repository,
run the provided SQL file in the Supabase SQL Editor:

``` text
supabase-chat-rooms.sql
```

Do not commit `.env.local` or any file containing private credentials.

### 5. Start the development server

``` bash
npm run dev
```

Open:

``` text
http://localhost:3000
```

------------------------------------------------------------------------

## Environment Variables

The project uses environment variables for Supabase configuration.

  Variable                          Description
  --------------------------------- -------------------------------
  `NEXT_PUBLIC_SUPABASE_URL`        Supabase project URL
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`   Supabase public anonymous key

Keep private server-side credentials separate from public client-side
variables and never commit secrets to GitHub.

------------------------------------------------------------------------

## Development

Run the development server:

``` bash
npm run dev
```

Build the project:

``` bash
npm run build
```

Run the production server:

``` bash
npm start
```

Lint the project if a lint script is configured:

``` bash
npm run lint
```

------------------------------------------------------------------------

## Deployment

Shotzi can be deployed using Vercel.

### Basic deployment flow

``` text
GitHub
   ↓
Vercel
   ↓
Next.js Application
   ↓
Supabase
```

When deploying, add the required environment variables in the Vercel
project settings.

Make sure your Supabase project URL and public anonymous key are
configured for the production environment.

------------------------------------------------------------------------

## Security

Never commit sensitive credentials.

Make sure files such as these remain ignored:

``` text
.env
.env.local
.env.*.local
```

The repository should contain only safe example variables in
`.env.example`.

If a secret is accidentally pushed to GitHub, rotate the credential
immediately.

------------------------------------------------------------------------

## Roadmap

Planned improvements may include:

-   [ ] Improved discovery and explore experience
-   [ ] Better media optimization
-   [ ] Advanced profile customization
-   [ ] Notifications
-   [ ] Improved reels experience
-   [ ] More social interactions
-   [ ] Performance and caching improvements
-   [ ] Progressive Web App support
-   [ ] Expanded admin dashboard

------------------------------------------------------------------------

## Design Philosophy

Shotzi is built around three principles:

**Simple**\
Posting should not feel complicated.

**Visual**\
The interface should keep the focus on the content.

**Personal**\
Your profile should feel like your own collection of moments.

------------------------------------------------------------------------

## Contributing

Contributions, ideas, and improvements are welcome.

1.  Fork the repository
2.  Create a feature branch

``` bash
git checkout -b feature/your-feature
```

3.  Make your changes
4.  Commit your changes

``` bash
git commit -m "Add your feature"
```

5.  Push the branch

``` bash
git push origin feature/your-feature
```

6.  Open a Pull Request

------------------------------------------------------------------------

## Author

### Apoorv Mehrotra

Computer Science & Engineering student and developer focused on
full-stack development, AI/ML, and building practical products.

**Portfolio:** [its-apoorv.me](https://www.its-apoorv.me/)\
**GitHub:**
[@programmerbeast2004](https://github.com/programmerbeast2004)\
**LinkedIn:** [Apoorv
Mehrotra](https://www.linkedin.com/in/its-apoorv-/)

------------------------------------------------------------------------

## License

This project is currently available for learning and development
purposes.

