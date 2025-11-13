
import plotly.graph_objects as go

# Create a flowchart using Plotly shapes and annotations
fig = go.Figure()

# Define node positions (x, y coordinates)
nodes = {
    'A': (2, 11, 'rect', 'Match Scheduled'),
    'B': (2, 10, 'rect', 'Create Pairing'),
    'C': (2, 9, 'rect', 'Send Notif'),
    'D': (2, 8, 'rect', 'Start Timer'),
    'E': (2, 7, 'diamond', 'Both Online?'),
    'F': (4, 7, 'rect', 'Create Room'),
    'G': (2, 6, 'rect', 'Wait'),
    'H': (2, 5, 'diamond', 'Player Online?'),
    'I': (1, 4.5, 'rect', 'Notify P2'),
    'J': (3, 4.5, 'rect', 'Notify P1'),
    'K': (2, 3.5, 'diamond', 'Timer Expired?'),
    'L': (2, 2.5, 'diamond', 'Check Activity'),
    'M': (0.5, 1.5, 'rect', 'Both Forfeit'),
    'N': (2, 1.5, 'rect', 'P1 Wins'),
    'O': (3.5, 1.5, 'rect', 'P2 Wins'),
    'P': (4, 3, 'rect', 'Record Result'),
    'Q': (4, 2, 'rect', 'Update Standings'),
    'R': (4, 1, 'rect', 'Notify Players'),
}

# Draw rectangles and diamonds
for key, (x, y, shape, label) in nodes.items():
    if shape == 'rect':
        # Rectangle
        fig.add_shape(type="rect", x0=x-0.4, y0=y-0.3, x1=x+0.4, y1=y+0.3,
                     line=dict(color="#21808d", width=2), fillcolor="#e8f4f5")
        fig.add_annotation(x=x, y=y, text=label, showarrow=False, 
                          font=dict(size=10, color="#13343b"))
    else:  # diamond
        # Create diamond shape using path
        path = f"M {x},{y+0.35} L {x+0.45},{y} L {x},{y-0.35} L {x-0.45},{y} Z"
        fig.add_shape(type="path", path=path,
                     line=dict(color="#21808d", width=2), fillcolor="#f3f3ee")
        fig.add_annotation(x=x, y=y, text=label, showarrow=False,
                          font=dict(size=9, color="#13343b"))

# Define connections (arrows)
arrows = [
    ('A', 'B'), ('B', 'C'), ('C', 'D'), ('D', 'E'),
    ((2, 7.35), (2.6, 7.35), 'Yes'),  # E to F
    ((2, 6.65), (2, 6.3)),  # E to G (No)
    ('G', 'H'),
    ((1.55, 5), (1, 4.8), 'P1'),  # H to I
    ((2.45, 5), (3, 4.8), 'P2'),  # H to J
    ((2.45, 7), (3.6, 7)),  # H to F (Both)
    ((1, 4.2), (1.5, 3.85)),  # I to K
    ((3, 4.2), (2.5, 3.85)),  # J to K
    ((2, 3.15), (2, 2.85)),  # K to L (Yes)
    ((1.55, 3.5), (1.55, 5), 'No'),  # K to H (No) - loop back
    ((1.55, 2.5), (0.5, 1.8), 'Neither'),  # L to M
    ((2, 2.15), (2, 1.8)),  # L to N (P1)
    ((2.45, 2.5), (3.5, 1.8), 'P2'),  # L to O
    ((3.6, 7), (4, 3.3)),  # F to P
    ((0.5, 1.2), (3.7, 3)),  # M to P
    ((2, 1.2), (3.9, 3)),  # N to P
    ((3.5, 1.2), (4, 2.7)),  # O to P
    ('P', 'Q'), ('Q', 'R'),
]

# Draw arrows
for arrow in arrows:
    if len(arrow) == 2:
        if isinstance(arrow[0], str) and isinstance(arrow[1], str):
            x1, y1 = nodes[arrow[0]][0], nodes[arrow[0]][1]
            x2, y2 = nodes[arrow[1]][0], nodes[arrow[1]][1]
        else:
            x1, y1 = arrow[0]
            x2, y2 = arrow[1]
        label = None
    else:
        if isinstance(arrow[0], str):
            x1, y1 = nodes[arrow[0]][0], nodes[arrow[0]][1]
            x2, y2 = nodes[arrow[1]][0], nodes[arrow[1]][1]
        else:
            x1, y1 = arrow[0]
            x2, y2 = arrow[1]
        label = arrow[2]
    
    fig.add_annotation(
        x=x2, y=y2, ax=x1, ay=y1,
        xref="x", yref="y", axref="x", ayref="y",
        showarrow=True, arrowhead=2, arrowsize=1, arrowwidth=1.5,
        arrowcolor="#333333", text=label if label else "",
        font=dict(size=8, color="#21808d"), bgcolor="#f3f3ee"
    )

# Update layout
fig.update_layout(
    title="Match Scheduling & Auto-Forfeit",
    showlegend=False,
    xaxis=dict(visible=False, range=[-0.5, 5]),
    yaxis=dict(visible=False, range=[0, 12]),
    plot_bgcolor="#f3f3ee",
    paper_bgcolor="#f3f3ee",
)

# Save the figure
fig.write_image("match_scheduling_flowchart.png")
fig.write_image("match_scheduling_flowchart.svg", format="svg")

print("Flowchart created successfully")
