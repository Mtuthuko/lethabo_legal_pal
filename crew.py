# crew.py

from crewai import Task, Crew, Process
from crewai import Agent, Crew, Process
from agents import get_research_agents

def create_legal_crew(llm, topic):
    """
    Assembles and returns the research crew with its tasks.
    """
    agents = get_research_agents(llm)
    # Unpack the agents for clarity
    legal_researcher, law_simplifier, scenario_creator, content_reviewer = agents

    # Define tasks for the research crew
    research_task = Task(
        description=f"Conduct comprehensive research on South African law regarding: '{topic}'.",
        expected_output="A report with relevant Acts, section numbers, and the raw text of critical sections.",
        agent=legal_researcher
    )

    simplify_task = Task(
        description="Take the legal research report and translate it into simple, plain English. Avoid jargon.",
        expected_output="A clear, easy-to-read explanation titled 'The Law in Plain English'.",
        agent=law_simplifier
    )

    scenarios_task = Task(
        description="Based on the simplified explanation, create 3 practical, everyday scenarios.",
        expected_output="A list of 3 scenarios under the heading 'How This Affects You: Real-Life Examples'.",
        agent=scenario_creator
    )

    review_task = Task(
        description="Review all content for accuracy and clarity. Combine everything into a single, well-formatted document. Add a friendly introduction and a concluding disclaimer.",
        expected_output="A final, polished document including a friendly intro, the simplified law, scenarios, and a disclaimer.",
        agent=content_reviewer,
        context=[research_task, simplify_task, scenarios_task]
    )

    # Assemble the crew
    legal_crew = Crew(
        agents=agents,
        tasks=[research_task, simplify_task, scenarios_task, review_task],
        process=Process.sequential,
        verbose=True
    )
    
    return legal_crew