
import plotly.graph_objects as go

# Create a flowchart using Plotly shapes and annotations
fig = go.Figure()

# Define node positions (x, y coordinates)
nodes = {
    'A': (0.5, 11, 'User Browses\nChampionships'),
    'B': (0.5, 10, 'Select\nChampionship'),
    'C': (0.5, 9, 'Registration\nOpen?'),
    'D': (0.2, 8, 'Registration\nClosed Message'),
    'E': (0.5, 7.5, 'Click Register\n& Pay Button'),
    'F': (0.5, 6.5, 'Redirect to\nRazorpay'),
    'G': (0.5, 5.5, 'User Completes\nPayment'),
    'H': (0.5, 4.5, 'Razorpay\nWebhook'),
    'I': (0.5, 3.5, 'Backend\nValidates?'),
    'J': (0.2, 2.5, 'Show Error\n& Refund'),
    'K': (0.5, 2, 'Create\nParticipant'),
    'L': (0.5, 1, 'Send Confirm\nEmail'),
    'M': (0.5, 0, 'Update Count'),
    'N': (0.5, -1, 'Registration\nSuccessful'),
}

# Rectangle nodes
rect_nodes = ['A', 'B', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N']
# Diamond nodes (decisions)
diamond_nodes = ['C', 'I']

# Add rectangle nodes
for node_id in rect_nodes:
    x, y, text = nodes[node_id]
    fig.add_shape(type="rect", x0=x-0.15, y0=y-0.3, x1=x+0.15, y1=y+0.3,
                  line=dict(color="#21808d", width=2), fillcolor="#e8f4f5")
    fig.add_annotation(x=x, y=y, text=text, showarrow=False, 
                      font=dict(size=10, color="#13343b"))

# Add diamond nodes
for node_id in diamond_nodes:
    x, y, text = nodes[node_id]
    fig.add_shape(type="path",
                  path=f"M {x},{y-0.35} L {x+0.2},{y} L {x},{y+0.35} L {x-0.2},{y} Z",
                  line=dict(color="#21808d", width=2), fillcolor="#f3f3ee")
    fig.add_annotation(x=x, y=y, text=text, showarrow=False,
                      font=dict(size=9, color="#13343b"))

# Add arrows with annotations
arrows = [
    ('A', 'B', ''),
    ('B', 'C', ''),
    ('C', 'D', 'Closed'),
    ('C', 'E', 'Open'),
    ('E', 'F', ''),
    ('F', 'G', ''),
    ('G', 'H', ''),
    ('H', 'I', ''),
    ('I', 'J', 'Invalid'),
    ('I', 'K', 'Valid'),
    ('K', 'L', ''),
    ('L', 'M', ''),
    ('M', 'N', ''),
]

for start, end, label in arrows:
    x0, y0, _ = nodes[start]
    x1, y1, _ = nodes[end]
    
    # Adjust arrow positions
    if start == 'C' and end == 'D':
        x0, x1 = x0 - 0.15, x1 + 0.15
    elif start == 'C' and end == 'E':
        y0 = y0 - 0.35
    elif start == 'I' and end == 'J':
        x0, x1 = x0 - 0.15, x1 + 0.15
    elif start == 'I' and end == 'K':
        y0 = y0 - 0.35
    else:
        y0 = y0 - 0.3 if start in rect_nodes else y0 - 0.35
        y1 = y1 + 0.3 if end in rect_nodes else y1 + 0.35
    
    fig.add_annotation(
        x=x1, y=y1, ax=x0, ay=y0,
        xref="x", yref="y", axref="x", ayref="y",
        showarrow=True, arrowhead=2, arrowsize=1, arrowwidth=2,
        arrowcolor="#333333"
    )
    
    if label:
        mid_x, mid_y = (x0 + x1) / 2, (y0 + y1) / 2
        fig.add_annotation(x=mid_x, y=mid_y, text=label, showarrow=False,
                          font=dict(size=9, color="#21808d"),
                          bgcolor="#e8f4f5", borderpad=2)

fig.update_xaxes(range=[-0.1, 1.1], showticklabels=False, showgrid=False, zeroline=False)
fig.update_yaxes(range=[-2, 12], showticklabels=False, showgrid=False, zeroline=False)
fig.update_layout(
    title="Championship Registration Flow",
    showlegend=False,
    plot_bgcolor='#f3f3ee',
    paper_bgcolor='#f3f3ee'
)

fig.write_image('championship_flow.png')
fig.write_image('championship_flow.svg', format='svg')
