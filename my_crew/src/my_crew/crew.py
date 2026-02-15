from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from crewai.agents.agent_builder.base_agent import BaseAgent
from typing import List

from my_crew.output_schemas import OrchestratorOutput, RiskAssessmentOutput
from my_crew.tools import (
    FilterResourcesTool,
    GreedyAllocationTool,
    GreedyAllocationBatchTool,
    PredictBedNeedTool,
    PredictLengthOfStayTool,
)
# If you want to run a snippet of code before or after the crew starts,
# you can use the @before_kickoff and @after_kickoff decorators
# https://docs.crewai.com/concepts/crews#example-crew-class-with-decorators

@CrewBase
class MyCrew():
    """MyCrew crew"""

    agents: List[BaseAgent]
    tasks: List[Task]

    # Learn more about YAML configuration files here:
    # Agents: https://docs.crewai.com/concepts/agents#yaml-configuration-recommended
    # Tasks: https://docs.crewai.com/concepts/tasks#yaml-configuration-recommended
    
    # If you would like to add tools to your agents, you can learn more about it here:
    # https://docs.crewai.com/concepts/agents#agent-tools
    @agent
    def risk_agent(self) -> Agent:
        return Agent(
            config=self.agents_config['risk_agent'], # type: ignore[index]
            tools=[PredictBedNeedTool(), PredictLengthOfStayTool()],
            verbose=True
        )

    @agent
    def resource_agent(self) -> Agent:
        return Agent(
            config=self.agents_config['resource_agent'], # type: ignore[index]
            tools=[FilterResourcesTool()],
            verbose=True
        )

    @agent
    def orchestrator_agent(self) -> Agent:
        return Agent(
            config=self.agents_config['orchestrator_agent'], # type: ignore[index]
            tools=[GreedyAllocationTool(), GreedyAllocationBatchTool()],
            verbose=True
        )

    # To learn more about structured task outputs,
    # task dependencies, and task callbacks, check out the documentation:
    # https://docs.crewai.com/concepts/tasks#overview-of-a-task
    @task
    def risk_assessment_task(self) -> Task:
        return Task(
            config=self.tasks_config['risk_assessment_task'], # type: ignore[index]
            output_pydantic=RiskAssessmentOutput,
        )

    @task
    def resource_task(self) -> Task:
        return Task(
            config=self.tasks_config['resource_task'], # type: ignore[index]
        )

    @task
    def orchestrator_task(self) -> Task:
        return Task(
            config=self.tasks_config['orchestrator_task'], # type: ignore[index]
            output_pydantic=OrchestratorOutput,
        )

    @crew
    def crew(self) -> Crew:
        """Creates the MyCrew crew"""
        # To learn how to add knowledge sources to your crew, check out the documentation:
        # https://docs.crewai.com/concepts/knowledge#what-is-knowledge

        return Crew(
            agents=self.agents, # Automatically created by the @agent decorator
            tasks=self.tasks, # Automatically created by the @task decorator
            process=Process.sequential,
            verbose=True,
            # process=Process.hierarchical, # In case you wanna use that instead https://docs.crewai.com/how-to/Hierarchical/
        )
