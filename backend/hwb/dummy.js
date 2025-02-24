const input = [
    {
      xpr: [
        {
          ref: [
            "groupFilterStampings",
          ],
        },
        "!=",
        {
          val: "google-oauth2|116650139011172932408,google-oauth2|110308980441055299844",
        },
        "or",
        {
          ref: [
            "groupFilterStampings",
          ],
        },
        "=",
        {
          val: null,
        },
      ],
    },
  ];

  function extractFilters(filters, operator) {
    if (!filters) {
      return null;
    }
    if(filters[0]?.xpr){
      filters = filters[0].xpr;
    }
    let result = {};
    for (let i = 0; i < filters.length; i++) {
      if (filters[i].ref) {
        // Extract the reference
        let ref = filters[i].ref[0];
        // Check if the next element is '=' and the element after that has a value
        if (filters[i + 1] === operator && filters[i + 2] && filters[i + 2].val) {
          // Store the reference and its value
          result[ref] = filters[i + 2].val;
          // Skip the next two elements
          i += 2;
        }
      }
    }
    return result;
  }

  extractFilters(input, "!=");