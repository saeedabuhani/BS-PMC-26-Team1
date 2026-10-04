# ANTE — CI/CD Academic Learning Platform

An interactive web platform that teaches **CI/CD and DevOps** through practice instead of slides. Students walk through the *Code → Build → Test → Deploy* stages, write and run real Python code in the browser, and earn a completion certificate. Lecturers manage content and review submissions; admins manage users and the system.

> Team project developed at Sami Shamoon College of Engineering (SCE) by a four-student team. This is a private copy of the team repository with its full commit history. The original README is kept in [`docs/README_ORIGINAL.md`](docs/README_ORIGINAL.md).

## What it does

- **Learning modules** with quiz and coding exercises, and progress tracking
- **Embedded Monaco editor** (the VS Code editor) with Python syntax highlighting
- **Secure Python sandbox**: isolated execution with a timeout, memory limits and blocked dangerous imports
- **Animated CI/CD pipeline** simulation with terminal output
- **Student unit tests**: students write and run their own tests after solving a challenge
- **Role-based panels** for students, lecturers and admins, including lecturer code review and feedback
- **Security hardening**: CSRF tokens, login throttling, session timeout and an audit log
- **Completion certificate** generated as a PDF

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12, Flask 3 |
| Data | SQLAlchemy 2, SQLite (default), MS SQL Server (optional) |
| Frontend | Jinja2 templates, custom CSS, Monaco Editor |
| Testing | pytest, pytest-cov, flake8 (370 tests reported by the team) |
| CI/CD | GitHub Actions: build, test and coverage, plus an Azure deployment readiness check |

## How to run

```bash
python -m venv venv
venv\Scripts\activate            # Windows (source venv/bin/activate on Linux/macOS)
pip install -r requirements.txt
python app.py                    # then open http://127.0.0.1:5000
```

Optional demo data (local demo accounts only):

```bash
python scripts/seed_demo.py
```

Run the tests:

```bash
python -m pytest -v
python -m pytest --cov=app --cov-report=html
```

## My role

Saeed Abu Hani, 132 of the 327 commits across all branches. Based on the commit history:

- **CI/CD pipeline**: created and maintained the GitHub Actions workflows (`ci.yml` for build, test and coverage, a hackathon workflow, and the Azure readiness check)
- **Repository structure**: reorganised the project layout (moving modules into `app/` and `app/services/`) and merged work between branches
- **Backend modules**: contributed to models, authorization, database initialisation and services (questions, progress, reports)
- **Documentation**: maintained the README

## Team

| Member | GitHub | Commits (all branches) |
|---|---|---|
| Saeed Abu Hani | [@abohaab-cell](https://github.com/abohaab-cell) | 132 |
| Borh2n | [@Borh2n](https://github.com/Borh2n) | 112 |
| Yosef Nsasra | [@yosef870](https://github.com/yosef870) | 43 |
| Yakoob Hasone | [@YakoobHasone](https://github.com/YakoobHasone) | 40 |

The original repository belongs to the course organisation `BS-PMC-2026` (`BS-PMC-26-Team1`). All credit for the shared work goes to the whole team.

## Screenshots

_To be added._
