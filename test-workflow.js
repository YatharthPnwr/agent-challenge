// Test script to verify workflow functionality
// Since we can't directly import TypeScript files, let's test via the Mastra server

async function testWorkflow() {
  try {
    console.log('Testing GitHub Reporter Workflow via API...');
    
    // Try the workflow endpoint
    const workflowResponse = await fetch('http://localhost:8080/workflows/github-reporter-workflow/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        repoUrl: 'https://github.com/facebook/react-native'
      })
    });
    
    if (workflowResponse.ok) {
      const result = await workflowResponse.json();
      console.log('✅ Workflow API call successful!');
      console.log('Report length:', result.report?.length || 'No report field');
      
      if (result.report) {
        const hasBarChart = result.report.includes('![Repository Statistics Bar Chart]');
        const hasPieChart = result.report.includes('![Language Distribution Pie Chart]');
        
        console.log('Chart presence check:');
        console.log('Bar chart present:', hasBarChart);
        console.log('Pie chart present:', hasPieChart);
        
        if (hasBarChart && hasPieChart) {
          console.log('✅ SUCCESS: Both charts are present in the report!');
        } else {
          console.log('❌ FAILURE: Missing charts in the report');
        }
      }
    } else {
      console.log('❌ Workflow API call failed:', workflowResponse.status, workflowResponse.statusText);
      
      // Try the agent endpoint
      console.log('\nTrying agent endpoint...');
      const agentResponse = await fetch('http://localhost:8080/agents/githubReporterAgent/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: 'Analyze https://github.com/facebook/react-native'
          }]
        })
      });
      
      if (agentResponse.ok) {
        const result = await agentResponse.json();
        console.log('✅ Agent API call successful!');
        console.log('Response type:', typeof result);
        console.log('Response keys:', Object.keys(result));
      } else {
        console.log('❌ Agent API call failed:', agentResponse.status, agentResponse.statusText);
      }
    }
    
  } catch (error) {
    console.error('Error testing workflow:', error);
  }
}

testWorkflow(); 