# BENCHMARK

## Test Prompts

### Spreadsheet

Shows me the present value of $1000 monthly income over a year, making it easy to change the discount rate.

Create a loan amortization schedule for a $250,000 mortgage at 6% annual interest over 30 years with monthly payments. Show payment number, payment amount, interest, principal, and remaining balance for the first year.

Create a compound interest calculator showing the growth of $10,000 invested at different annual interest rates (3%, 5%, 7%, 10%) over 10 years. Show yearly balances. Make sure the interest rates can be easily modified.

Create a retirement savings calculator showing how much you need to save monthly to reach $1,000,000 by age 65. Include columns for current age, target age, monthly contribution, annual return rate (adjustable), and projected final balance.

Build a break-even analysis calculator for a small business. Show fixed costs ($50,000), variable cost per unit ($25), and selling price per unit ($60). Calculate the break-even point in units and revenue, with easy-to-modify input parameters.

Create a budget tracker comparing monthly income vs expenses across 6 categories (Housing, Food, Transportation, Entertainment, Savings, Other). Show totals, surplus/deficit, and percentage of income for each category. Make it easy to adjust the amounts.

I have an employee database in columns A-D. Column A has employee IDs (101, 102, 103),
  column B has names (John, Sarah, Mike), column C has departments (Sales, IT, HR), and
  column D has hire dates (1/15/2020, 3/22/2018, 7/10/2021).

  Create formulas to:
  - Find how many years each employee has been with the company
  - Look up Sarah's department
  - Calculate the total months of service for employee 102
  - Find the hire date of the employee in the IT department

I have a product catalog where column A contains product codes (SKU001, SKU002, SKU003),
   column B has product names (Widget, Gadget, Doohickey), column C has prices (29.99,
  49.99, 19.99), and column D has price expiry dates (12/31/2025, 6/30/2026, 3/15/2026).

  Help me create formulas to:
  - Look up the price for product code SKU002
  - Calculate how many days until each price expires
  - Find which product name corresponds to the price 19.99
  - Check if any prices expire within the next 90 days

I'm tracking project milestones with task IDs in column A (T001, T002, T003), task names
   in column B (Design, Development, Testing), start dates in column C (1/1/2025,
  2/15/2025, 4/1/2025), and end dates in column D (2/14/2025, 3/31/2025, 5/15/2025).

  Create formulas to:
  - Calculate the duration in days for each task
  - Find the end date for the 'Development' task
  - Determine which tasks are currently active (today falls between start and end dates)
  - Calculate total project duration from earliest start to latest end

I have invoices with invoice numbers in column A (INV-001, INV-002, INV-003), customer
  names in column B (Acme Corp, Beta Inc, Gamma LLC), invoice dates in column C (10/1/2025,
   10/15/2025, 11/1/2025), and amounts in column D (1500, 2300, 890).

  Help me:
  - Calculate how many days each invoice has been outstanding
  - Look up the invoice date for customer 'Beta Inc'
  - Find which invoices are over 30 days old
  - Get the amount for invoice number INV-002

I maintain a list with employee IDs in column A (E001, E002, E003), names in column B
  (Alice, Bob, Carol), birthdates in column C (5/12/1990, 8/23/1985, 2/14/1992), and work
  anniversary dates in column D (1/10/2018, 6/15/2019, 9/1/2020).

  Create formulas to:
  - Calculate each employee's current age
  - Find how many years Bob has been with the company
  - Look up Carol's birthday
  - Identify if any employee has a birthday this month
  - Calculate the exact difference between Alice's birthday and work anniversary in years,
  months, and days

I track software subscriptions with service names in row 1 across columns A-E (Slack,
  GitHub, AWS, Figma, Jira), subscription start dates in row 2 (1/1/2024, 3/15/2024,
  6/1/2024, 9/10/2024, 11/20/2024), and renewal dates in row 3 (1/1/2025, 3/15/2025,
  6/1/2025, 9/10/2025, 11/20/2025).

  Help me create formulas to:
  - Look up the renewal date for GitHub using horizontal lookup
  - Calculate days remaining until each service renews
  - Find which service started on 6/1/2024
  - Determine how many months each subscription has been active

I need a comprehensive equipment depreciation tracker. In columns A-F, I have equipment IDs
  (EQ001-EQ010), purchase dates (various dates in 2020-2023), purchase prices ($5,000-$50,000),
  useful life in years (5-10 years), and salvage values (10% of purchase price). Create a
  depreciation schedule that:
  - Calculates straight-line annual depreciation for each asset
  - Determines accumulated depreciation as of today's date (not full years)
  - Shows current book value (purchase price - accumulated depreciation)
  - Identifies which assets are fully depreciated
  - Calculates total portfolio value and total annual depreciation expense
  - Projects the depreciation expense for each of the next 5 fiscal years
  - Highlights assets that will be fully depreciated within the next 12 months
  Make sure the current date calculation updates automatically.

Build a multi-criteria employee performance dashboard. I have employee data across columns A-L:
  employee IDs, names, departments (Sales, Engineering, Marketing), hire dates, last review dates,
  performance scores (1-5), sales targets, actual sales, project completion rates (0-100%),
  customer satisfaction scores (1-10), training hours completed, and salary bands ($50k-$150k).
  Create an analysis that:
  - Calculates tenure in years and months for each employee
  - Determines if a performance review is overdue (>365 days since last review)
  - Computes a weighted performance index combining: performance score (40%), target achievement
    (30%), project completion (20%), and customer satisfaction (10%)
  - Identifies top performers in each department using the weighted index
  - Calculates average tenure by department and performance tier (top 25%, middle 50%, bottom 25%)
  - Finds employees eligible for promotion (tenure >2 years, performance index >80, review current)
  - Shows salary efficiency: performance index divided by salary band percentile
  - Creates a retention risk score based on: low recent performance, high tenure, overdue review
  All date-based calculations should reference today's date dynamically.

Design an advanced project portfolio analyzer with timeline optimization. Set up a table with
  columns A-M containing: project IDs, project names, client names, start dates, planned end dates,
  actual completion dates (blank if ongoing), budget amounts, spent to date, assigned team size,
  priority levels (1-5), risk categories (Low/Medium/High), revenue potential, and dependencies
  (references to other project IDs). Build formulas to:
  - Calculate planned duration, actual duration (or current duration if ongoing), and variance in days
  - Determine project health status: "On Track" if within 10% of timeline and budget, "At Risk" if
    10-25% over, "Critical" if >25% over
  - Identify overdue projects (planned end date passed but no completion date)
  - Calculate weighted portfolio value: (revenue potential × priority level) / team size
  - Find resource conflicts: projects with overlapping timelines assigned to same team members
  - Compute cash burn rate: total spent / days elapsed since start for each active project
  - Create a project dependency chain showing which projects block others from starting
  - Calculate expected completion dates for dependent projects based on current progress rates
  - Show portfolio-level metrics: total projects, percentage on-track/at-risk/critical, average
    budget variance, total revenue at risk from critical projects
  Support automatic recalculation as project status and dates are updated.

### ShapeScript

Make 6 cylinders in a row with colors gradually changing from red to blue

Visualize a simple molecular structure - a water molecule with one large red sphere
  (oxygen) and two smaller white spheres (hydrogen) bonded to it

 Create a dice - a cube with spherical indents on each face 

 Create a 3D sine wave using spheres along the x-axis

 Design a simple temple structure with a central large cube as the main building, four
  cylindrical pillars at the corners, and a cone on top as a roof

Make a cube with three cylindrical holes drilled through it - one through each axis (x,
  y, z)

Make a ring (torus shape) by subtracting a smaller cylinder from a larger cylinder, then
   subtract a cube from the result to create a flat edge

Design a simple gear - start with a cylinder and subtract 12 small cubes around its edge
   to create teeth

Make a Venn diagram in 3D - two cylinders that overlap, showing the intersection region
  in a different color

Design a simple robot head - union of a cube (head), two small spheres (eyes), and a
  cylinder (antenna on top)

Create a star shape by taking a sphere and subtracting 6 cones arranged in a circular
  pattern pointing inward

Make a target/bullseye in 3D - concentric cylinders alternating solid and hollow (using
  difference operations)"

### Markdown

Create a document, which explains how Jet Engines work.

Make a travel guide for Tokyo with pictures of 3 famous landmarks

Create a recipe for chocolate chip cookies with images for each major step

Explain quantum entanglement with visual aids for a high school audience

Write a short children's story about a space adventure with 4 illustrations

Create an anatomy guide with detailed medical illustrations of the human heart showing all chambers, valves, and blood vessels

Write an article about the solar system with an image for each planet

Create a field guide for identifying birds with photos of 5 common species

### Presentation (Mulmocast)

Create a presentation about the water cycle for elementary school students

Make a 5-slide pitch deck for a sustainable coffee startup seeking seed funding

Create a presentation explaining how neural networks work

Tell the story of the Apollo 11 moon landing as a presentation

Create a presentation about the history of the internet from 1960s to today

Make a presentation teaching basic photography composition techniques

Create a motivational presentation about overcoming challenges and building resilience

Make a presentation explaining climate change causes and solutions

Create a presentation about the life cycle of a butterfly for kids

Create a presentation introducing Japanese culture and customs to tourists

Make a presentation about the Roman Empire's rise and fall

Create a cooking presentation showing how to make homemade pasta from scratch

Make a presentation about the solar system with interesting facts about each planet

Create a presentation about the importance of sleep and sleep hygiene

## HTML

create an interactive web page that demonstrates how a 4-cycle (4-stroke) engine works with animations and explanations.
