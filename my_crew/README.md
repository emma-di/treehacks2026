# MyCrew Crew

Welcome to the MyCrew Crew project, powered by [crewAI](https://crewai.com). This template is designed to help you set up a multi-agent AI system with ease, leveraging the powerful and flexible framework provided by crewAI. Our goal is to enable your agents to collaborate effectively on complex tasks, maximizing their collective intelligence and capabilities.

## Installation

Ensure you have Python >=3.10 <3.14 installed on your system. This project uses [UV](https://docs.astral.sh/uv/) for dependency management and package handling, offering a seamless setup and execution experience.

First, if you haven't already, install uv:

```bash
pip install uv
```

Next, navigate to your project directory and install the dependencies:

(Optional) Lock the dependencies and install them by using the CLI command:
```bash
crewai install
```
### Customizing

**Add your `OPENAI_API_KEY` into the `.env` file**

- Modify `src/my_crew/config/agents.yaml` to define your agents
- Modify `src/my_crew/config/tasks.yaml` to define your tasks
- Modify `src/my_crew/crew.py` to add your own logic, tools and specific args
- Modify `src/my_crew/main.py` to add custom inputs for your agents and tasks

## Running the Project

To kickstart your crew of AI agents and begin task execution, run this from the root folder of your project:

```bash
$ crewai run
```

This command initializes the my_crew Crew, assembling the agents and assigning them tasks as defined in your configuration.

### Test scenarios (more complicated examples)

You can run the crew with different scenarios via the `CREWAI_SCENARIO` environment variable:

| Scenario   | Description |
|-----------|-------------|
| `default` | Moderate risk (Observation), small roster and map. |
| `critical` | High acuity (Critical): sepsis, declining vitals, ICU-only staff and Negative Pressure/Isolation rooms. |
| `complex` | Large staff roster, many rooms, mixed certs and loads; CHF exacerbation, multiple feasible options. |
| `waitlist` | No feasible options (ICU rooms occupied, General only); tests priority queue / waitlist path. |
| `multi` | **Multiple patients** (A, B, C): orchestrator produces **one assignment per patient** via batch tool; no double-booking. |

Examples:

```bash
# Default (Observation, small example)
crewai run

# Critical patient (ICU, Negative Pressure/Isolation)
CREWAI_SCENARIO=critical crewai run

# Complex (many nurses/rooms, Observation)
CREWAI_SCENARIO=complex crewai run

# Waitlist (no room ready – tests waitlist position by risk score)
CREWAI_SCENARIO=waitlist crewai run

# Multi-patient (one assignment per patient; batch allocation, no double-booking)
CREWAI_SCENARIO=multi crewai run
```

## Understanding Your Crew

The my_crew Crew is composed of multiple AI agents, each with unique roles, goals, and tools. These agents collaborate on a series of tasks, defined in `config/tasks.yaml`, leveraging their collective skills to achieve complex objectives. The `config/agents.yaml` file outlines the capabilities and configurations of each agent in your crew.

## Support

For support, questions, or feedback regarding the MyCrew Crew or crewAI.
- Visit our [documentation](https://docs.crewai.com)
- Reach out to us through our [GitHub repository](https://github.com/joaomdmoura/crewai)
- [Join our Discord](https://discord.com/invite/X4JWnZnxPb)
- [Chat with our docs](https://chatg.pt/DWjSBZn)

Let's create wonders together with the power and simplicity of crewAI.
